"use client";

import { useState, useMemo } from "react";
import { LogiFlowLayout } from "@/components/layout/LogiFlowLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  UserPlus, 
  Truck, 
  CheckCircle, 
  XCircle, 
  MoreVertical, 
  Phone,
  LayoutGrid,
  Loader2,
  Trash2,
  Pencil,
  Search,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, addDoc, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from "@/lib/firestore-mock";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().min(8, "Telefone inválido"),
  plate: z.string().min(3, "Placa inválida"),
  vehicle: z.string().min(2, "Veículo é obrigatório"),
  status: z.enum(["Disponível", "Em Trânsito", "Inativo"]),
});

export default function DriversPage() {
  const db = useFirestore();
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "drivers"), orderBy("name"));
  }, [db]);

  const { data: drivers, loading: dataLoading } = useCollection(driversQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      plate: "",
      vehicle: "Moto",
      status: "Disponível",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!db || !isAdmin) return;
    setIsSubmitting(true);

    try {
      if (editingDriver) {
        await updateDoc(doc(db, "drivers", editingDriver.id), values);
      } else {
        await addDoc(collection(db, "drivers"), {
          ...values,
          createdAt: serverTimestamp(),
          ownerId: user?.uid || "public"
        });
      }

      setIsDialogOpen(false);
      setEditingDriver(null);
      form.reset();
      
      toast({
        title: "Sucesso!",
        description: editingDriver ? "O motoboy foi atualizado." : "O motoboy foi cadastrado.",
      });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: editingDriver ? `drivers/${editingDriver.id}` : "drivers",
        operation: editingDriver ? "update" : "create",
        requestResourceData: values,
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddNew() {
    if (!isAdmin) return;
    setEditingDriver(null);
    form.reset({
      name: "",
      phone: "",
      plate: "",
      vehicle: "Moto",
      status: "Disponível",
    });
    setIsDialogOpen(true);
  }

  function handleEdit(driver: any) {
    if (!isAdmin) return;
    setEditingDriver(driver);
    form.reset({
      name: driver.name,
      phone: driver.phone,
      plate: driver.plate,
      vehicle: driver.vehicle,
      status: driver.status as "Disponível" | "Em Trânsito" | "Inativo",
    });
    setTimeout(() => setIsDialogOpen(true), 50);
  }

  async function handleDeleteDriver(id: string) {
    if (!db || !isAdmin) return;
    
    try {
      await deleteDoc(doc(db, "drivers", id));
      toast({
        title: "Motoboy removido",
        description: "O entregador foi excluído do sistema.",
      });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: `drivers/${id}`,
        operation: "delete",
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }

  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    return drivers.filter((d: any) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.plate?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, drivers]);

  const stats = useMemo(() => {
    return {
      available: drivers?.filter((d: any) => d.status === "Disponível").length || 0,
      inTransit: drivers?.filter((d: any) => d.status === "Em Trânsito").length || 0,
      inactive: drivers?.filter((d: any) => d.status === "Inativo").length || 0,
    };
  }, [drivers]);

  return (
    <LogiFlowLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Motoboys</h1>
            <p className="text-muted-foreground mt-1">Monitore e gerencie seus entregadores ativos.</p>
          </div>
          {isAdmin ? (
            <Button className="font-bold shadow-lg shadow-primary/10" onClick={handleAddNew}>
              <UserPlus size={18} className="mr-2" /> Novo Motoboy
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border">
              <Lock size={12} className="text-accent" /> Modo Visualização
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-panel p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Disponíveis</p>
              <h3 className="text-3xl font-bold text-primary mt-1">{stats.available}</h3>
            </div>
            <CheckCircle className="text-primary/30" size={32} />
          </Card>
          <Card className="glass-panel p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Em Trânsito</p>
              <h3 className="text-3xl font-bold text-secondary mt-1">{stats.inTransit}</h3>
            </div>
            <Truck className="text-secondary/30" size={32} />
          </Card>
          <Card className="glass-panel p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inativos</p>
              <h3 className="text-3xl font-bold text-accent mt-1">{stats.inactive}</h3>
            </div>
            <XCircle className="text-accent/30" size={32} />
          </Card>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingDriver(null);
            form.reset({
              name: "",
              phone: "",
              plate: "",
              vehicle: "Moto",
              status: "Disponível",
            });
          }
        }}>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingDriver ? "Editar Motoboy" : "Cadastrar Motoboy"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: João da Silva" {...field} className="bg-muted/30" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="(43) 9..." {...field} className="bg-muted/30" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC-1234" {...field} className="bg-muted/30 uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vehicle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Veículo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Moto 150cc" {...field} className="bg-muted/30" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Inicial</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-muted/30">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Disponível">Disponível</SelectItem>
                            <SelectItem value="Em Trânsito">Em Trânsito</SelectItem>
                            <SelectItem value="Inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingDriver ? "Salvar Alterações" : "Salvar Motoboy")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Diretório de Pessoal</CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou placa..."
                className="pl-10 h-8 bg-muted/30 border-border text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4">Detalhes do Motoboy</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Veículo / Placa</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center">
                        <Loader2 className="animate-spin inline-block mr-2" size={16} />
                        Sincronizando entregadores...
                      </td>
                    </tr>
                  ) : filteredDrivers.length > 0 ? (
                    filteredDrivers.map((driver: any) => (
                      <tr key={driver.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border text-primary font-bold">
                              {driver.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{driver.name}</p>
                              <p className="text-[10px] text-muted-foreground">ID: {driver.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Phone size={14} className="text-secondary" />
                            {driver.phone}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             <Truck size={14} className="text-muted-foreground" />
                             <span className="text-sm text-muted-foreground font-medium">{driver.vehicle}</span>
                             <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded border border-border uppercase">{driver.plate}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                            driver.status === "Disponível" ? "bg-primary/10 text-primary border-primary/20" : 
                            driver.status === "Em Trânsito" ? "bg-secondary/10 text-secondary border-secondary/20" : 
                            "bg-muted text-muted-foreground border-border"
                          )}>
                            {driver.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Gestão</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className={cn("cursor-pointer", !isAdmin && "opacity-50 cursor-not-allowed")} 
                                onSelect={() => isAdmin && handleEdit(driver)}
                              >
                                <Pencil size={14} className="mr-2" /> Editar Dados
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className={cn("text-destructive focus:text-destructive cursor-pointer", !isAdmin && "opacity-50 cursor-not-allowed")} 
                                onSelect={() => isAdmin && handleDeleteDriver(driver.id)}
                              >
                                <Trash2 size={14} className="mr-2" /> Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic text-sm">
                        Nenhum motoboy encontrado.
                      </td>
                    </tr>
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
