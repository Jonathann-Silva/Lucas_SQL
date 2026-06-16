
"use client";

import { useState, useMemo, useEffect } from "react";
import { LogiFlowLayout } from "@/components/layout/LogiFlowLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { 
  CalendarDays, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  Wallet, 
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "@/lib/firestore-mock";
import { 
  format, 
  startOfYear, 
  endOfYear, 
  eachMonthOfInterval, 
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  isValid
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function MonthlyReportsPage() {
  const db = useFirestore();
  
  // Inicializa no ano atual, mas garante que não seja menor que 2026
  const [selectedYear, setSelectedYear] = useState(() => {
    const current = new Date().getFullYear();
    return Math.max(current, 2026).toString();
  });

  // Busca todas as entregas (o cache local ajuda aqui)
  const deliveriesQuery = useMemo(() => {
    if (!db) return null;
    const yearInt = parseInt(selectedYear);
    const startIso = startOfYear(new Date(yearInt, 0, 1)).toISOString();
    const endIso = endOfYear(new Date(yearInt, 0, 1)).toISOString();
    return query(collection(db, `deliveries?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`), orderBy("timestamp", "desc"));
  }, [db, selectedYear]);

  const { data: deliveries, loading } = useCollection(deliveriesQuery);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const availableYears = new Set<string>();
    
    // Adiciona o ano atual e 2026 por padrão
    availableYears.add(currentYear.toString());
    availableYears.add("2026");
    
    if (deliveries) {
      deliveries.forEach((d: any) => {
        const date = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        if (isValid(date)) {
          const year = date.getFullYear();
          if (year >= 2026) {
            availableYears.add(year.toString());
          }
        }
      });
    }

    // Garante que o ano selecionado esteja na lista
    availableYears.add(selectedYear);

    return Array.from(availableYears)
      .sort((a, b) => b.localeCompare(a));
  }, [deliveries, selectedYear]);

  const monthlyData = useMemo(() => {
    if (!deliveries) return [];

    const yearInt = parseInt(selectedYear);
    const intervalStart = startOfYear(new Date(yearInt, 0, 1));
    const intervalEnd = endOfYear(new Date(yearInt, 0, 1));

    const months = eachMonthOfInterval({
      start: intervalStart,
      end: intervalEnd
    });

    return months.map(month => {
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);

      const monthDeliveries = deliveries.filter((d: any) => {
        const date = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        return isValid(date) && isWithinInterval(date, { start: mStart, end: mEnd });
      });

      const revenue = monthDeliveries
        .filter((d: any) => d.type === "LUCRO")
        .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0);

      const expenses = monthDeliveries
        .filter((d: any) => d.type === "GASTO")
        .reduce((acc, d: any) => acc + (Number(d.fee) || 0), 0);

      const count = monthDeliveries.filter((d: any) => d.type === "LUCRO").length;

      return {
        name: format(month, 'MMMM', { locale: ptBR }),
        shortName: format(month, 'MMM', { locale: ptBR }),
        revenue,
        expenses,
        profit: revenue - expenses,
        count
      };
    });
  }, [deliveries, selectedYear]);

  const yearStats = useMemo(() => {
    return monthlyData.reduce((acc, curr) => ({
      totalRevenue: acc.totalRevenue + curr.revenue,
      totalExpenses: acc.totalExpenses + curr.expenses,
      totalProfit: acc.totalProfit + curr.profit,
      totalDeliveries: acc.totalDeliveries + curr.count
    }), { totalRevenue: 0, totalExpenses: 0, totalProfit: 0, totalDeliveries: 0 });
  }, [monthlyData]);

  const handlePrevYear = () => {
    const current = parseInt(selectedYear);
    if (current > 2026) {
      setSelectedYear((current - 1).toString());
    }
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => (parseInt(prev) + 1).toString());
  };

  return (
    <LogiFlowLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fechamento Mensal</h1>
            <p className="text-muted-foreground mt-1">Consolidado anual de faturamento e repasses.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handlePrevYear}
                disabled={parseInt(selectedYear) <= 2026}
              >
                <ChevronLeft size={16} className={cn(parseInt(selectedYear) <= 2026 && "opacity-20")} />
              </Button>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[80px] h-8 border-none bg-transparent font-bold [&>svg]:hidden text-center justify-center">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handleNextYear}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
            {loading && <Loader2 className="animate-spin text-muted-foreground" size={18} />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-panel p-6 border-l-4 border-l-secondary">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Faturamento {selectedYear}</p>
            <h3 className="text-2xl font-bold text-secondary mt-1">
              R$ {yearStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground font-bold">
              <TrendingUp size={12} className="text-primary" />
              <span>Receita total das lojas</span>
            </div>
          </Card>
          
          <Card className="glass-panel p-6 border-l-4 border-l-destructive">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gastos Motoboys</p>
            <h3 className="text-2xl font-bold text-destructive mt-1">
              R$ {yearStats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground font-bold">
              <Coins size={12} className="text-destructive" />
              <span>Repasses acumulados</span>
            </div>
          </Card>

          <Card className="glass-panel p-6 border-l-4 border-l-primary">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lucro Líquido Anual</p>
            <h3 className={cn(
              "text-2xl font-bold mt-1",
              yearStats.totalProfit >= 0 ? "text-primary" : "text-destructive"
            )}>
              R$ {yearStats.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground font-bold">
              <Wallet size={12} className="text-primary" />
              <span>Saldo final do período</span>
            </div>
          </Card>

          <Card className="glass-panel p-6 border-l-4 border-l-accent">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Volume de Corridas</p>
            <h3 className="text-2xl font-bold text-accent mt-1">
              {yearStats.totalDeliveries.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground font-bold">
              <CalendarDays size={12} className="text-accent" />
              <span>Entregas realizadas</span>
            </div>
          </Card>
        </div>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg">Comparativo Receita vs Despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" vertical={false} />
                  <XAxis 
                    dataKey="shortName" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888', fontSize: 12, fontWeight: 'bold' }}
                    textAnchor="middle"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888', fontSize: 10 }}
                    tickFormatter={(val) => `R$ ${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #2a2a2e' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: any) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    name="Receita" 
                    fill="#18b67a" 
                    radius={[4, 4, 0, 0]} 
                    fillOpacity={0.8} 
                  />
                  <Bar 
                    dataKey="expenses" 
                    name="Despesa" 
                    fill="#ef4444" 
                    radius={[4, 4, 0, 0]} 
                    fillOpacity={0.8} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {monthlyData.map((month, idx) => (
            <Card key={idx} className={cn(
              "glass-panel hover:border-primary/50 transition-all group",
              month.revenue === 0 && month.expenses === 0 && "opacity-40 grayscale"
            )}>
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center justify-between">
                  {month.name}
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                    {month.count} Entregas
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Receita</span>
                  <span className="text-sm font-bold text-secondary">R$ {month.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Despesa</span>
                  <span className="text-sm font-bold text-destructive">R$ {month.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Saldo</span>
                  <span className={cn(
                    "text-sm font-bold",
                    month.profit >= 0 ? "text-primary" : "text-destructive"
                  )}>
                    R$ {month.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </LogiFlowLayout>
  );
}
