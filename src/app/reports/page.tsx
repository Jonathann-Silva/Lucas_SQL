"use client";

import { useState, useMemo, useEffect } from "react";
import { LogiFlowLayout } from "@/components/layout/LogiFlowLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  FileText, 
  Search, 
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  AlertTriangle,
  Store,
  Truck,
  Layers,
  Lock
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc } from "@/lib/firestore-mock";
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, addDays, parseISO } from "date-fns";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportsPage() {
  const db = useFirestore();
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  
  const today = new Date();
  const currentMonday = startOfWeek(today, { weekStartsOn: 1 });
  const currentSaturday = addDays(currentMonday, 5);

  const [startDate, setStartDate] = useState(format(currentMonday, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(currentSaturday, 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState<"all" | "LUCRO" | "GASTO">("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [search, setSearch] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [accordionValue, setAccordionValue] = useState<string[]>([]);

  useEffect(() => {
    setAccordionValue([]);
  }, [startDate, endDate, reportType, selectedStore]);

  const storesQuery = useMemo(() => db ? query(collection(db, "stores"), orderBy("name")) : null, [db]);
  const driversQuery = useMemo(() => db ? query(collection(db, "drivers"), orderBy("name")) : null, [db]);
  const deliveriesQuery = useMemo(() => db ? query(collection(db, "deliveries"), orderBy("timestamp", "asc")) : null, [db]);

  const { data: stores } = useCollection(storesQuery);
  const { data: drivers } = useCollection(driversQuery);
  const { data: deliveries, loading: loadingDeliveries } = useCollection(deliveriesQuery);

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

  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return [];
    
    const filtered = deliveries.filter((d: any) => {
      const deliveryDate = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
      
      const isInRange = isWithinInterval(deliveryDate, {
        start: startOfDay(parseISO(startDate)),
        end: endOfDay(parseISO(endDate))
      });

      const isTypeMatch = reportType === "all" || d.type === reportType;

      const isStoreMatch = selectedStore === "all" || d.storeId === selectedStore || d.driverId === selectedStore;
      
      const isSearchMatch = search === "" || 
        d.cleanedAddress?.toLowerCase().includes(search.toLowerCase()) ||
        d.storeName?.toLowerCase().includes(search.toLowerCase()) ||
        d.driverName?.toLowerCase().includes(search.toLowerCase());

      return isInRange && isTypeMatch && isStoreMatch && isSearchMatch;
    });

    return filtered.sort((a: any, b: any) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });
  }, [deliveries, startDate, endDate, reportType, selectedStore, search]);

  const groupedDeliveries = useMemo(() => {
    const groups: Record<string, { items: any[], totalFee: number, name: string, type: string }> = {};
    
    filteredDeliveries.forEach(d => {
      const groupName = d.storeName || d.driverName || "Geral";
      if (!groups[groupName]) {
        groups[groupName] = { 
          items: [], 
          totalFee: 0, 
          name: groupName,
          type: d.type || (d.storeName ? "LUCRO" : "GASTO")
        };
      }
      groups[groupName].items.push(d);
      groups[groupName].totalFee += (Number(d.fee) || 0);
    });
    
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [filteredDeliveries]);

  const exportIndividualPDFs = async () => {
    if (groupedDeliveries.length === 0) {
      toast({
        variant: "destructive",
        title: "Nada para exportar",
        description: "Não há registros no período selecionado.",
      });
      return;
    }

    setIsExporting(true);

    try {
      for (const group of groupedDeliveries) {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.setTextColor(24, 182, 122); 
        doc.text("Lucas Expresso | Gestão", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Relatório de Fechamento Semanal`, 14, 28);
        doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 14, 33);

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`Unidade: ${group.name}`, 14, 45);
        doc.setFontSize(10);
        doc.text(`Tipo de Lançamento: ${group.type === "LUCRO" ? "Faturamento Loja" : "Repasse Motoboy"}`, 14, 50);

        const tableBody = group.items.map(item => [
          item.timestamp?.toDate 
            ? format(item.timestamp.toDate(), 'dd/MM')
            : format(new Date(item.timestamp), 'dd/MM'),
          item.cleanedAddress,
          `R$ ${Number(item.fee).toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: 55,
          head: [['Data', 'Endereço Destino', 'Valor Frete']],
          body: tableBody,
          theme: 'striped',
          headStyles: { fillColor: [24, 182, 122] },
          styles: { fontSize: 9 },
          columnStyles: {
            2: { halign: 'right' }
          },
          didDrawCell: (data) => {
            if (data.section === 'body') {
              const rowIndex = data.row.index;
              const nextItem = group.items[rowIndex + 1];
              
              if (nextItem) {
                const currentItem = group.items[rowIndex];
                const currentDate = currentItem.timestamp?.toDate 
                  ? format(currentItem.timestamp.toDate(), 'dd/MM')
                  : format(new Date(currentItem.timestamp), 'dd/MM');
                
                const nextDate = nextItem.timestamp?.toDate 
                  ? format(nextItem.timestamp.toDate(), 'dd/MM')
                  : format(new Date(nextItem.timestamp), 'dd/MM');

                if (currentDate !== nextDate) {
                  doc.setDrawColor(24, 182, 122);
                  doc.setLineWidth(0.8);
                  doc.line(
                    data.cell.x, 
                    data.cell.y + data.cell.height, 
                    data.cell.x + data.cell.width, 
                    data.cell.y + data.cell.height
                  );
                }
              }
            }
          }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Total de Entregas: ${group.items.length}`, 14, finalY);
        doc.text(`Valor Total Acumulado: R$ ${group.totalFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, finalY + 7);

        const fileName = `${group.name.replace(/\s+/g, '_')}_${format(parseISO(startDate), 'dd-MM')}.pdf`;
        doc.save(fileName);
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      toast({
        title: "Exportação Concluída",
        description: `${groupedDeliveries.length} PDFs foram gerados com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const metrics = useMemo(() => {
    const total = filteredDeliveries.length;
    const totalRevenue = filteredDeliveries
      .filter((d: any) => d.type === "LUCRO")
      .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0);
    
    const totalExpenses = filteredDeliveries
      .filter((d: any) => d.type === "GASTO")
      .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0);
    
    return [
      { label: "Registros Filtrados", val: total.toLocaleString(), color: "border-primary" },
      { label: "Total Lojas (Lucro)", val: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: "border-secondary" },
      { label: "Total Motos (Gasto)", val: `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: "border-destructive" },
      { label: "Unidades Ativas", val: groupedDeliveries.length.toString(), color: "border-accent" },
    ];
  }, [filteredDeliveries, groupedDeliveries]);

  const handleDeleteItem = (id: string) => {
    if (!db || !isAdmin) return;
    deleteDoc(doc(db, "deliveries", id))
      .then(() => {
        toast({
          title: "Registro removido",
          description: "O lançamento foi excluído com sucesso.",
        });
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: `deliveries/${id}`,
          operation: "delete",
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleBulkDelete = async () => {
    if (!db || !isAdmin || filteredDeliveries.length === 0) return;
    
    setIsDeleting(true);
    let deletedCount = 0;

    try {
      for (const item of filteredDeliveries) {
        await deleteDoc(doc(db, "deliveries", item.id));
        deletedCount++;
      }
      
      toast({
        title: "Limpeza concluída",
        description: `${deletedCount} registros foram removidos do período.`,
      });
    } catch (error) {
      console.error("Erro na exclusão em massa:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <LogiFlowLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relatórios e Fechamento</h1>
            <p className="text-muted-foreground mt-1">Gestão de dados semanais (Segunda a Sábado).</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="font-bold h-12 px-6" disabled={filteredDeliveries.length === 0 || isDeleting}>
                    {isDeleting ? <Loader2 className="animate-spin mr-2" size={18} /> : <Trash2 size={18} className="mr-2" />}
                    Limpar Filtro
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="text-destructive" /> Atenção!
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso excluirá permanentemente **{filteredDeliveries.length} registros** que estão aparecendo no seu filtro atual.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Confirmar Exclusão
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button 
              className="font-bold shadow-lg shadow-primary/10 h-12 px-8" 
              onClick={exportIndividualPDFs}
              disabled={isExporting || groupedDeliveries.length === 0}
            >
              {isExporting ? <Loader2 className="animate-spin mr-2" size={18} /> : <FileText size={18} className="mr-2" />}
              Exportar PDFs
            </Button>
          </div>
        </div>

        <Card className="glass-panel">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Navegação Semanal</label>
                  <div className="flex bg-muted/30 p-1 rounded-lg border border-border h-10">
                    <Button variant="ghost" size="sm" className="h-full flex-1" onClick={handlePrevWeek}>
                      <ChevronLeft size={16} />
                    </Button>
                    <div className="flex-[3] flex items-center justify-center text-xs font-bold uppercase px-2 text-center">
                      {format(parseISO(startDate), 'dd/MM')} - {format(parseISO(endDate), 'dd/MM')}
                    </div>
                    <Button variant="ghost" size="sm" className="h-full flex-1" onClick={handleNextWeek}>
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Início / Fim</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-muted/50 border-border h-10 text-xs" 
                    />
                    <Input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-muted/50 border-border h-10 text-xs" 
                    />
                  </div>
                </div>
              </div>
              <div className="md:col-span-6 lg:col-span-2 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo de Operação</label>
                <Select value={reportType} onValueChange={(v: any) => { setReportType(v); setSelectedStore("all"); }}>
                  <SelectTrigger className="bg-muted/50 border-border h-10">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="LUCRO">Lojas (Receita)</SelectItem>
                    <SelectItem value="GASTO">Motoboys (Gasto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-6 lg:col-span-2 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Favorecido / Unidade</label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="bg-muted/50 border-border h-10">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {reportType === "all" && (
                      <>
                        <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase bg-muted/20">Lojas</div>
                        {stores?.map((store: any) => (
                          <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                        ))}
                        <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase bg-muted/20 mt-2">Motoboys</div>
                        {drivers?.map((driver: any) => (
                          <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {reportType === "LUCRO" && stores?.map((store: any) => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                    {reportType === "GASTO" && drivers?.map((driver: any) => (
                      <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {metrics.map((m) => (
            <Card key={m.label} className={cn("glass-panel p-4 border-l-4", m.color)}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <h4 className="text-xl font-bold mt-1">{m.val}</h4>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Operações Agrupadas</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input 
                placeholder="Buscar por nome ou endereço..." 
                className="h-8 pl-8 text-xs bg-muted/20 border-border w-[250px]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingDeliveries ? (
            <div className="py-20 text-center flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" size={32} />
              <span>Sincronizando fechamento...</span>
            </div>
          ) : groupedDeliveries.length > 0 ? (
            <Accordion 
              type="multiple" 
              value={accordionValue} 
              onValueChange={setAccordionValue}
              className="space-y-3"
            >
              {groupedDeliveries.map((group, idx) => {
                const isSpecialStore = group.name.toLowerCase().includes("frete pago") || 
                                       group.name.toLowerCase().includes("jean") || 
                                       group.name.toLowerCase().includes("moreira");
                
                return (
                  <AccordionItem key={idx} value={`item-${idx}`} className="glass-panel border rounded-lg px-6">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center border",
                          group.type === "GASTO" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          {group.type === "GASTO" ? <Truck size={20} /> : <Store size={20} />}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">{group.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            {group.items.length} entregas nesta semana
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Acumulado</p>
                        <p className="text-lg font-mono font-bold text-foreground">
                          R$ {group.totalFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6">
                    <div className="overflow-x-auto rounded-md border border-border/50 bg-muted/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/10 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                            <th className="px-4 py-3">Data</th>
                            {isSpecialStore && <th className="px-4 py-3">Endereço Coleta</th>}
                            <th className="px-4 py-3">Endereço Destino</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {group.items.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 text-[10px] text-muted-foreground">
                                {item.timestamp?.toDate 
                                  ? format(item.timestamp.toDate(), 'dd/MM')
                                  : format(new Date(item.timestamp), 'dd/MM')}
                              </td>
                              {isSpecialStore && (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <MapPin size={12} className="text-muted-foreground" />
                                    <span className="text-xs truncate max-w-md">{item.pickupAddress || "-"}</span>
                                  </div>
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <MapPin size={12} className="text-muted-foreground" />
                                  <span className="text-xs truncate max-w-md">{item.cleanedAddress}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-xs">
                                R$ {Number(item.fee).toFixed(2)}
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-3 text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <Card className="glass-panel py-20 text-center flex flex-col items-center gap-3 text-muted-foreground opacity-50">
              <Layers size={48} />
              <p className="text-sm italic">Nenhum registro encontrado para este período.</p>
            </Card>
          )}
        </div>
      </div>
    </LogiFlowLayout>
  );
}
