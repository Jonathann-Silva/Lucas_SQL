"use client";

import React, { useState, useMemo } from "react";
import { LogiFlowLayout } from "@/components/layout/LogiFlowLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  FileSpreadsheet, 
  Upload, 
  Database,
  Layers,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  CalendarDays,
  AlertCircle,
  TrendingUp,
  Coins,
  ChevronLeft,
  ChevronRight,
  Lock,
  Calendar
} from "lucide-react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, orderBy, addDoc } from "@/lib/firestore-mock";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, parseISO, isValid } from "date-fns";

interface ExcelRow {
  endereco: string;
  taxa?: number;
  zona?: string;
  data?: Date;
}

interface ImportGroup {
  sheetName: string;
  rows: ExcelRow[];
  matchedId?: string;
  matchedName?: string;
  defaultFee?: number;
}

export default function ExcelImportPage() {
  const db = useFirestore();
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importGroups, setImportGroups] = useState<ImportGroup[]>([]);
  const [fileName, setFileName] = useState("");
  const [importType, setImportType] = useState<"LUCRO" | "GASTO" | null>(null);
  
  const today = new Date();
  const currentMonday = startOfWeek(today, { weekStartsOn: 1 });
  const currentSaturday = addDays(currentMonday, 5);

  const [startDate, setStartDate] = useState(format(currentMonday, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(currentSaturday, 'yyyy-MM-dd'));

  const handlePrevWeek = () => {
    const currentStart = parseISO(startDate);
    const newStart = addDays(currentStart, -7);
    const newEnd = addDays(newStart, 5);
    setStartDate(format(newStart, 'yyyy-MM-dd'));
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
  };

  const handleNextWeek = () => {
    const currentStart = parseISO(startDate);
    const newStart = addDays(currentStart, 7);
    const newEnd = addDays(newStart, 5);
    setStartDate(format(newStart, 'yyyy-MM-dd'));
    setEndDate(format(newEnd, 'yyyy-MM-dd'));
  };

  const handleCurrentWeek = () => {
    setStartDate(format(currentMonday, 'yyyy-MM-dd'));
    setEndDate(format(currentSaturday, 'yyyy-MM-dd'));
  };

  const storesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "stores"), orderBy("name"));
  }, [db]);

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "drivers"), orderBy("name"));
  }, [db]);

  const { data: stores } = useCollection(storesQuery);
  const { data: drivers } = useCollection(driversQuery);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!importType) {
      toast({
        variant: "destructive",
        title: "Tipo não selecionado",
        description: "Selecione se a planilha é de Lojas ou Motoboys antes de continuar.",
      });
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setImportGroups([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const newGroups: ImportGroup[] = [];

        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          if (data.length <= 2) return;

          const processedRows: ExcelRow[] = [];
          const lastRowIndex = importType === "GASTO" ? Math.min(data.length, 8) : data.length;

          for (let i = 2; i < lastRowIndex; i++) {
            const row = data[i];
            if (!row || row.length < 1) continue;

            const firstCol = String(row[0] || "").toUpperCase().trim();
            if (firstCol.includes("TOTAL") || firstCol === "") continue;

            let rawDate: any;
            let rawAddress: any;
            let rawFee: any;

            if (importType === "LUCRO") {
              rawDate = row[0];
              rawAddress = row[4];
              rawFee = row[5];
            } else {
              rawDate = row[0];
              const quantity = row[2];
              rawAddress = quantity ? `Entregas: ${quantity}` : "Corrida Diária";
              rawFee = row[3];
            }

            if (!rawFee || isNaN(parseFloat(String(rawFee).replace('R$', '').replace(/\./g, '').replace(',', '.')))) continue;

            const addressStr = String(rawAddress || "Endereço não informado").trim();
            const feeValue = parseFloat(String(rawFee).replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

            let deliveryDate: Date | undefined;
            if (rawDate instanceof Date && isValid(rawDate)) {
              deliveryDate = rawDate;
            } else if (rawDate) {
              const d = new Date(rawDate);
              if (isValid(d)) deliveryDate = d;
            }

            if (!isNaN(feeValue)) {
              processedRows.push({
                endereco: addressStr,
                taxa: feeValue,
                zona: importType === "LUCRO" ? "Importação Loja" : "Importação Moto",
                data: deliveryDate
              });
            }
          }

          if (processedRows.length === 0) return;

          let matchedEntity: any = null;
          const cleanSheetName = sheetName.toLowerCase().trim();

          if (importType === "LUCRO") {
            matchedEntity = stores?.find((s: any) => 
              s.name.toLowerCase().trim() === cleanSheetName || 
              cleanSheetName.includes(s.name.toLowerCase().trim())
            );
            if (!matchedEntity && (cleanSheetName.includes("frete pago") || cleanSheetName.includes("geral"))) {
               matchedEntity = { id: "frete_pago_geral", name: "Frete Pago" };
            }
          } else {
            matchedEntity = drivers?.find((d: any) => 
              d.name.toLowerCase().trim() === cleanSheetName || 
              cleanSheetName.includes(d.name.toLowerCase().trim())
            );
            if (!matchedEntity && (cleanSheetName.includes("pagamento") || cleanSheetName.includes("frete"))) {
              matchedEntity = { id: "frete_pago_geral", name: "Frete Pago (Moto)" };
            }
          }

          newGroups.push({
            sheetName,
            rows: processedRows,
            matchedId: matchedEntity?.id,
            matchedName: matchedEntity?.name,
          });
        });

        setImportGroups(newGroups);
      } catch (error) {
        console.error("Erro ao processar Excel:", error);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportAll = async () => {
    if (!db || !isAdmin || importGroups.length === 0 || !importType) return;

    const validGroups = importGroups.filter(g => g.matchedId);
    setIsImporting(true);
    let totalImported = 0;

    try {
      const fallbackDate = parseISO(startDate);

      for (const group of validGroups) {
        const promises = group.rows.map(row => 
          addDoc(collection(db, "deliveries"), {
            cleanedAddress: row.endereco,
            fee: row.taxa || 0,
            zoneTag: row.zona || "Padrão",
            ...(importType === "LUCRO" ? {
              storeId: group.matchedId,
              storeName: group.matchedName,
            } : {
              driverId: group.matchedId,
              driverName: group.matchedName,
            }),
            type: importType,
            status: "Concluído",
            timestamp: row.data || fallbackDate,
            source: "excel_import_v6"
          })
        );
        await Promise.all(promises);
        totalImported += group.rows.length;
      }
      
      toast({
        title: "Importação concluída!",
        description: `${totalImported} registros foram salvos com sucesso.`,
      });
      
      setImportGroups([]);
      setFileName("");
    } catch (error) {
      console.error("Erro ao importar:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const totalValidRows = useMemo(() => {
    return importGroups
      .filter(g => g.matchedId)
      .reduce((acc, g) => acc + g.rows.length, 0);
  }, [importGroups]);

  return (
    <LogiFlowLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Importação Inteligente</h1>
            <p className="text-muted-foreground mt-1">Sincronize seus fechamentos semanais do Excel.</p>
          </div>
          {!isAdmin && (
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border">
                <Lock size={12} className="text-accent" /> Modo Visualização (Leitura)
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="glass-panel border-primary/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar size={18} className="text-primary" /> Período
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex bg-muted/30 p-1 rounded-lg border border-border">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevWeek}>
                    <ChevronLeft size={16} />
                  </Button>
                  <Button variant="ghost" className="h-8 flex-1 text-[10px] font-bold uppercase" onClick={handleCurrentWeek}>
                    Atual
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextWeek}>
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <div className="space-y-2 text-center">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground block">Início da Semana</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-xs bg-muted/20 text-center"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={cn(
              "glass-panel transition-colors",
              !importType ? "border-destructive/50" : "border-primary/20"
            )}>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp size={18} className="text-primary" /> Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={importType || ""} 
                  onValueChange={(v) => {
                    if (!isAdmin) return;
                    setImportType(v as "LUCRO" | "GASTO");
                    setImportGroups([]);
                    setFileName("");
                  }}
                  className="grid grid-cols-1 gap-4"
                  disabled={!isAdmin}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="LUCRO" id="lucro" />
                    <Label htmlFor="lucro" className="font-bold text-xs uppercase cursor-pointer">Lojas (Receita)</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="GASTO" id="gasto" />
                    <Label htmlFor="gasto" className="font-bold text-xs uppercase cursor-pointer">Motoboys (Gasto)</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card className="glass-panel border-secondary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload size={18} className="text-secondary" /> Planilha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="excel-upload"
                    disabled={isProcessing || !isAdmin}
                  />
                  <label
                    htmlFor="excel-upload"
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                      "hover:bg-primary/5 hover:border-primary/50",
                      fileName ? "border-primary/50" : "border-border",
                      (!importType || !isAdmin) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <FileSpreadsheet className={cn("mb-2", fileName ? "text-primary" : "text-muted-foreground")} size={32} />
                    <p className="text-[10px] font-medium text-center px-4 uppercase">
                      {fileName ? fileName : "Clique para selecionar"}
                    </p>
                  </label>
                </div>

                {importGroups.length > 0 && isAdmin && (
                  <Button 
                    className="w-full h-12 font-bold"
                    disabled={totalValidRows === 0 || isImporting}
                    onClick={handleImportAll}
                  >
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    Lançar no Banco
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <Card className="glass-panel">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-lg">Abas Encontradas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {isProcessing ? (
                    <div className="py-20 text-center flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="animate-spin" size={32} />
                      <span className="text-xs font-bold uppercase">Analisando abas...</span>
                    </div>
                  ) : importGroups.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-3 text-muted-foreground opacity-50">
                      <Layers size={48} />
                      <span className="text-xs uppercase font-bold">Nenhum arquivo carregado</span>
                    </div>
                  ) : (
                    importGroups.map((group, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center border",
                            group.matchedId ? "bg-primary/10 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"
                          )}>
                            <Layers size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm uppercase">{group.sheetName}</h4>
                            <p className="text-[10px] text-muted-foreground font-bold">
                              {group.rows.length} REGISTROS
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {group.matchedId ? (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase">
                              Vínculo: {group.matchedName}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full uppercase">
                              Sem Cadastro
                            </span>
                          )}
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setImportGroups(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </LogiFlowLayout>
  );
}
