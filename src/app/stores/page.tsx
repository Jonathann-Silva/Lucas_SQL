"use client";

import { useState, useMemo } from "react";
import { LogiFlowLayout } from "@/components/layout/LogiFlowLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  FormDescription,
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
  Store as StoreIcon,
  Plus,
  Search,
  MoreVertical,
  TrendingUp,
  Loader2,
  Trash2,
  Pencil,
  Zap,
  ZapOff,
  MapPin,
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
  type: z.string().min(2, "Tipo é obrigatório"),
  phone: z.string().min(8, "Telefone inválido"),
  status: z.enum(["Ativo", "Inativo"]),
  autoProcess: z.boolean().default(true),
});

export default function StoresPage() {
  const db = useFirestore();
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"TODAS" | "ATIVAS" | "INATIVAS">("TODAS");
  const [search, setSearch] = useState("");

  const storesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "stores"), orderBy("name"));
  }, [db]);

  const { data: stores, loading: dataLoading } = useCollection(storesQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      phone: "",
      status: "Ativo",
      autoProcess: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!db || !isAdmin) return;
    setIsSubmitting(true);

    try {
      if (editingStore) {
        await updateDoc(doc(db, "stores", editingStore.id), values);
      } else {
        await addDoc(collection(db, "stores"), {
          ...values,
          createdAt: serverTimestamp(),
          ownerId: user?.uid || "public"
        });
      }

      setIsDialogOpen(false);
      setEditingStore(null);
      form.reset();
      
      toast({
        title: "Sucesso!",
        description: editingStore ? "A loja foi atualizada corretamente." : "A loja foi cadastrada corretamente.",
      });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: editingStore ? `stores/${editingStore.id}` : "stores",
        operation: editingStore ? "update" : "create",
        requestResourceData: values,
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddNew() {
    if (!isAdmin) return;
    setEditingStore(null);
    form.reset({
      name: "",
      type: "",
      phone: "",
      status: "Ativo",
      autoProcess: true,
    });
    setIsDialogOpen(true);
  }

  function handleEdit(store: any) {
    if (!isAdmin) return;
    setEditingStore(store);
    form.reset({
      name: store.name,
      type: store.type,
      phone: store.phone,
      status: store.status as "Ativo" | "Inativo",
      autoProcess: store.autoProcess ?? true,
    });
    setTimeout(() => setIsDialogOpen(true), 50);
  }

  async function handleDeleteStore(id: string) {
    if (!db || !isAdmin) return;
    
    try {
      await deleteDoc(doc(db, "stores", id));
      toast({
        title: "Loja excluída",
        description: "A unidade foi removida do sistema.",
      });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: `stores/${id}`,
        operation: "delete",
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }

  const filteredStores = useMemo(() => {
    if (!stores) return [];
    return stores.filter((store: any) => {
      const matchesFilter =
        filter === "TODAS" ||
        (filter === "ATIVAS" && store.status === "Ativo") ||
        (filter === "INATIVAS" && store.status === "Inativo");

      const matchesSearch =
        store.name?.toLowerCase().includes(search.toLowerCase()) ||
        store.type?.toLowerCase().includes(search.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [filter, search, stores]);

  const activeCount = useMemo(() => stores?.filter((s: any) => s.status === "Ativo").length || 0, [stores]);

  return (
    <LogiFlowLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lojas</h1>
            <p className="text-muted-foreground mt-1">Gerencie pontos de entrega e grupos de faturamento.</p>
          </div>

          {isAdmin ? (
            <Button className="font-bold shadow-lg shadow-primary/10" onClick={handleAddNew}>
              <Plus size={18} className="mr-2" /> Nova Loja
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border">
              <Lock size={12} className="text-accent" /> Modo Visualização
            </div>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingStore(null);
            form.reset({
              name: "",
              type: "",
              phone: "",
              status: "Ativo",
              autoProcess: true,
            });
          }
        }}>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingStore ? "Editar Loja" : "Cadastrar Nova Loja"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Loja (Mesmo da Aba Excel)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Burger Prime" {...field} className="bg-muted/30" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segmento</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Pizza" {...field} className="bg-muted/30" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 9..." {...field} className="bg-muted/30" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Operacional</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/30">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Ativo">Ativo</SelectItem>
                          <SelectItem value="Inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoProcess"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Vincular Importações</FormLabel>
                        <FormDescription className="text-[10px]">
                          Se ativado, as abas com este nome serão processadas nos fechamentos.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingStore ? "Salvar Alterações" : "Salvar Loja")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-panel p-6 col-span-1 md:col-span-2 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Unidades Cadastradas</p>
                <h3 className="text-4xl font-bold text-primary mt-2">
                  {stores?.length || 0}
                </h3>
              </div>
              <div className="p-3 bg-primary/20 rounded-xl text-primary">
                <StoreIcon size={28} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
              <TrendingUp size={14} />
              <span>{activeCount} Ativas em Arapongas-PR</span>
            </div>
          </Card>
          <Card className="glass-panel p-6 flex flex-col justify-between">
             <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matriz de Operação</p>
                <div className="flex items-center gap-2 mt-2 text-secondary">
                  <MapPin size={20} />
                  <h3 className="text-xl font-bold">Arapongas - PR</h3>
                </div>
             </div>
             <p className="text-[10px] text-muted-foreground mt-4">Gestão centralizada de todas as unidades</p>
          </Card>
        </div>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar lojas..."
                className="pl-10 bg-muted/30 border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["TODAS", "ATIVAS", "INATIVAS"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "outline" : "ghost"}
                  size="sm"
                  className={cn("text-xs font-bold", filter !== f && "text-muted-foreground")}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4">Identificação da Unidade</th>
                    <th className="px-6 py-4">Status de Importação</th>
                    <th className="px-6 py-4">Status Operacional</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="animate-spin" size={16} />
                          Carregando unidades...
                        </div>
                      </td>
                    </tr>
                  ) : filteredStores.length > 0 ? (
                    filteredStores.map((store: any) => (
                      <tr key={store.id} className={cn(
                        "hover:bg-muted/20 transition-colors group",
                        store.status === "Inativo" && "opacity-60"
                      )}>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border border-border text-primary group-hover:scale-110 transition-transform">
                              <StoreIcon size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold">{store.name}</p>
                              <p className="text-[10px] text-muted-foreground">{store.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {store.autoProcess !== false ? (
                            <div className="flex items-center gap-1.5 text-primary text-[10px] font-bold">
                              <Zap size={12} /> VINCULADA
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold">
                              <ZapOff size={12} /> MANUAL
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            store.status === "Ativo" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", store.status === "Ativo" ? "bg-primary" : "bg-muted-foreground")} />
                            {store.status}
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
                                onSelect={() => isAdmin && handleEdit(store)}
                              >
                                <Pencil size={14} className="mr-2" /> Editar Unidade
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className={cn("text-destructive focus:text-destructive cursor-pointer", !isAdmin && "opacity-50 cursor-not-allowed")} 
                                onSelect={() => isAdmin && handleDeleteStore(store.id)}
                              >
                                <Trash2 size={14} className="mr-2" /> Remover Unidade
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground text-sm italic">
                        Nenhuma loja encontrada.
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
