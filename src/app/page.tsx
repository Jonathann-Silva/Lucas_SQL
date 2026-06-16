
"use client";

import { useState, useMemo } from "react";
import { LogiFlowLayout } from "@/components/layout/LogiFlowLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Truck, 
  DollarSign, 
  Store, 
  Clock,
  Loader2,
  Wallet,
  Coins,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "@/lib/firestore-mock";
import { 
  format, 
  startOfWeek, 
  addDays, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  parseISO,
  isValid
} from "date-fns";

export default function Dashboard() {
  const db = useFirestore();

  // Estados de Filtro Semanal (Segunda a Sábado por padrão)
  const today = new Date();
  const currentMonday = startOfWeek(today, { weekStartsOn: 1 });
  const currentSaturday = addDays(currentMonday, 5);

  const [startDate, setStartDate] = useState(format(currentMonday, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(currentSaturday, 'yyyy-MM-dd'));

  // Navegação entre semanas
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

  // Busca entregas e lojas
  const deliveriesQuery = useMemo(() => {
    if (!db) return null;
    const startIso = startOfDay(parseISO(startDate)).toISOString();
    const endIso = endOfDay(parseISO(endDate)).toISOString();
    return query(collection(db, `deliveries?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`), orderBy("timestamp", "desc"));
  }, [db, startDate, endDate]);
  const storesQuery = useMemo(() => db ? query(collection(db, "stores")) : null, [db]);

  const { data: allDeliveries, loading: loadingDeliveries } = useCollection(deliveriesQuery);
  const { data: stores, loading: loadingStores } = useCollection(storesQuery);

  /**
   * Função auxiliar para conversão robusta de timestamp/data.
   */
  const getDeliveryDate = (timestamp: any) => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    }
    const date = new Date(timestamp);
    return isValid(date) ? date : null;
  };

  // Filtra entregas pelo período selecionado
  const filteredDeliveries = useMemo(() => {
    if (!allDeliveries) return [];
    
    const intervalStart = startOfDay(parseISO(startDate));
    const intervalEnd = endOfDay(parseISO(endDate));

    const filtered = allDeliveries.filter((d: any) => {
      const deliveryDate = getDeliveryDate(d.timestamp);
      if (!deliveryDate) return false;

      return isWithinInterval(deliveryDate, {
        start: intervalStart,
        end: intervalEnd
      });
    });

    return filtered.sort((a: any, b: any) => {
      const dateA = getDeliveryDate(a.timestamp) || new Date(0);
      const dateB = getDeliveryDate(b.timestamp) || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [allDeliveries, startDate, endDate]);

  const stats = useMemo(() => {
    // Identifica se é o registro da aba "Frete Pago" (Receitas de fretes avulsos)
    const isFretePago = (d: any) => 
      d.storeName?.toLowerCase().includes("frete pago") || 
      d.storeId === "frete_pago_geral";

    // Receita de lojas (excluindo os fretes recebidos avulsos)
    const totalRevenue = filteredDeliveries
      ?.filter((d: any) => d.type === "LUCRO" && !isFretePago(d))
      .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0) || 0;
      
    // Valor total recebido especificamente na aba "Frete Pago"
    const fretePagoValue = filteredDeliveries
      ?.filter((d: any) => isFretePago(d))
      .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0) || 0;
      
    // Gasto real com os repasses dos motoboys
    const totalExpenses = filteredDeliveries
      ?.filter((d: any) => d.type === "GASTO")
      .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0) || 0;
      
    const netProfit = (totalRevenue + fretePagoValue) - totalExpenses;
    const activeStores = stores?.filter((s: any) => s.status === "Ativo" && !s.name?.toLowerCase().includes("frete pago")).length || 0;
    const totalDeliveriesCount = filteredDeliveries.filter((d: any) => d.type === "LUCRO").length;

    return [
      { 
        label: "Entregas na Semana", 
        value: totalDeliveriesCount.toString(), 
        icon: Truck, 
        color: "text-primary", 
        change: "Volume de pedidos" 
      },
      { 
        label: "Faturamento Bruto", 
        value: `R$ ${(totalRevenue + fretePagoValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        icon: DollarSign, 
        color: "text-secondary", 
        change: "Lojas + Frete Pago" 
      },
      { 
        label: "Gasto Motoboys", 
        value: `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        icon: Coins, 
        color: "text-destructive", 
        change: "Repasses pagos" 
      },
      { 
        label: "Lucro Líquido", 
        value: `R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        icon: Wallet, 
        color: netProfit >= 0 ? "text-primary" : "text-destructive", 
        change: "Saldo operacional" 
      },
      { 
        label: "Lojas Ativas", 
        value: activeStores.toString(), 
        icon: Store, 
        color: "text-accent", 
        change: `${stores?.filter((s:any) => !s.name?.toLowerCase().includes("frete pago")).length || 0} cadastradas` 
      },
      { 
        label: "Frete pago", 
        value: `R$ ${fretePagoValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        icon: Clock, 
        color: "text-primary", 
        change: "Total da aba de frete" 
      },
    ];
  }, [filteredDeliveries, stores]);

  // Gráfico semanal detalhado (Segunda a Domingo)
  const chartData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    
    filteredDeliveries.forEach((d: any) => {
      if (d.type === "LUCRO") {
        const date = getDeliveryDate(d.timestamp);
        if (date) {
          const dayIndex = date.getDay(); 
          counts[dayIndex]++;
        }
      }
    });

    const orderedCounts = [counts[1], counts[2], counts[3], counts[4], counts[5], counts[6], counts[0]];
    const daysLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const maxCount = Math.max(...orderedCounts, 1);
    
    return orderedCounts.map((count, i) => ({
      day: daysLabels[i],
      count: count,
      percentage: (count / maxCount) * 100
    }));
  }, [filteredDeliveries]);

  const heatMapImage = PlaceHolderImages.find(img => img.id === 'heat-map')?.imageUrl;

  return (
    <LogiFlowLayout>
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Painel Semanal</h1>
            <p className="text-muted-foreground mt-1">
              Operações de <strong>{format(parseISO(startDate), 'dd/MM/yyyy')}</strong> até <strong>{format(parseISO(endDate), 'dd/MM/yyyy')}</strong>.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted/30 p-1 rounded-lg border border-border mr-2">
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handlePrevWeek}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold" onClick={handleCurrentWeek}>
                Semana Atual
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleNextWeek}>
                <ChevronRight size={16} />
              </Button>
            </div>
            {(loadingDeliveries || loadingStores) && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs bg-muted/30 px-3 py-2 rounded-full border border-border">
                <Loader2 size={12} className="animate-spin" />
                <span>Sincronizando...</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {stats.map((s) => (
            <Card key={s.label} className="glass-panel overflow-hidden border-t-2 border-t-transparent hover:border-t-primary transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </CardTitle>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold truncate">{s.value}</div>
                <div className="flex items-center gap-1 mt-1 text-[9px] font-semibold uppercase tracking-tight text-muted-foreground">
                  <ArrowUpRight size={10} className="text-primary" />
                  <span>{s.change}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 glass-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Volume de Entregas</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Distribuição de carga (Total: {filteredDeliveries.filter(d => d.type === "LUCRO").length})</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Calendar size={18} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex items-end justify-between gap-4 pt-12 pb-2">
                {chartData.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative">
                    <div className="text-[10px] font-bold text-muted-foreground mb-1 group-hover:text-primary transition-colors">
                      {data.count}
                    </div>
                    <div 
                      className="w-full bg-primary/40 rounded-t-md group-hover:bg-primary transition-all duration-300 relative border-x border-t border-primary/20"
                      style={{ height: `${Math.max(data.percentage, 4)}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-[10px] hidden group-hover:block whitespace-nowrap z-20 font-bold shadow-xl">
                        {data.count} Corridas
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2">
                      {data.day}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel relative overflow-hidden group">
            <div className="absolute inset-0 z-0">
               {heatMapImage && (
                 <Image 
                  src={heatMapImage} 
                  alt="Mapa de calor" 
                  fill 
                  className="object-cover opacity-20 grayscale transition-transform duration-700 group-hover:scale-110"
                  data-ai-hint="city map"
                />
               )}
            </div>
            <CardHeader className="relative z-10">
              <CardTitle>Zonas Logísticas</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Matriz Arapongas-PR</p>
            </CardHeader>
            <CardContent className="relative z-10 pt-10">
              <div className="space-y-4">
                {[
                  { name: "Centro / Matriz", value: "100%", color: "bg-primary" },
                  { name: "Zona Sul (Setor A)", value: "72%", color: "bg-secondary" },
                  { name: "Expansão Norte", value: "45%", color: "bg-accent" },
                ].map((zone) => (
                  <div key={zone.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{zone.name}</span>
                      <span>{zone.value}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", zone.color)} style={{ width: zone.value }} />
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-8 bg-card/80 backdrop-blur-md border border-border" variant="outline">
                Mapa Detalhado
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimos Lançamentos</CardTitle>
            <Button variant="link" className="text-primary p-0">Ver Relatórios</Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                    <th className="pb-4 px-2">Origem/Favorecido</th>
                    <th className="pb-4 px-2">Tipo</th>
                    <th className="pb-4 px-2">Data</th>
                    <th className="pb-4 px-2">Valor</th>
                    <th className="pb-4 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredDeliveries?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground italic text-sm">
                        Nenhum registro encontrado nesta semana.
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveries?.slice(-10).map((act: any) => {
                      const date = getDeliveryDate(act.timestamp);
                      const isFrete = act.storeName?.toLowerCase().includes("frete pago") || act.storeId === "frete_pago_geral";
                      return (
                        <tr key={act.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="py-4 px-2 text-sm font-medium">
                            {act.storeName || act.driverName || "Geral"}
                          </td>
                          <td className="py-4 px-2 text-[10px] font-bold">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded",
                              act.type === "GASTO" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
                            )}>
                              {act.type}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-xs text-muted-foreground">
                            {date ? format(date, 'dd/MM') : 'N/A'}
                          </td>
                          <td className="py-4 px-2 text-sm font-mono font-bold">R$ {Number(act.fee).toFixed(2)}</td>
                          <td className="py-4 px-2 text-sm">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              act.status === "Concluído" || act.status === "Entregue" ? "bg-primary/10 text-primary border border-primary/20" : 
                              "bg-muted text-muted-foreground border border-border"
                            )}>
                              {act.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </LogiFlowLayout>
  );
}
