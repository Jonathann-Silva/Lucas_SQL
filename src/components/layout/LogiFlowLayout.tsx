"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Store, 
  Truck, 
  FileSpreadsheet, 
  BarChart3, 
  Menu,
  Settings,
  LogOut,
  Package,
  CalendarRange
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import Image from "next/image";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Lojas", href: "/stores", icon: Store },
  { name: "Motoboys", href: "/drivers", icon: Truck },
  { name: "Importação Excel", href: "/whatsapp", icon: FileSpreadsheet },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Fechamento Mês", href: "/monthly-reports", icon: CalendarRange },
];

export function LogiFlowLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  
  const profileImg = PlaceHolderImages.find(img => img.id === 'ops-lead');
  const appLogo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Always Drawer style for professional look */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-card transition-transform duration-300 ease-in-out shadow-2xl",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white overflow-hidden border border-border">
              {appLogo ? (
                <Image 
                  src={appLogo.imageUrl} 
                  alt="Lucas Expresso Logo" 
                  width={40} 
                  height={40} 
                  className="object-contain"
                  data-ai-hint="motorcycle logo"
                />
              ) : (
                <Package size={24} className="text-primary" />
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-primary">Lucas Expresso</h1>
          </div>

          {user && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-8">
              <Avatar className="h-10 w-10 border border-primary/20">
                <AvatarImage src={user.photoURL || profileImg?.imageUrl} />
                <AvatarFallback>{user.displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.displayName || "Usuário"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-primary">Online</p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                    isActive 
                      ? "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/10" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon size={20} />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-border">
            <button className="flex items-center gap-3 px-4 py-2 w-full text-muted-foreground hover:text-foreground transition-colors">
              <Settings size={20} />
              <span className="text-sm">Configurações</span>
            </button>
            {user && (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 w-full text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut size={20} />
                <span className="text-sm">Sair</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest hidden sm:block">
              {navItems.find(item => item.href === pathname)?.name || "Dashboard"}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-border bg-white overflow-hidden">
              <AvatarImage src={appLogo?.imageUrl} alt="Logo" className="object-contain" />
              <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">
                {user?.displayName?.charAt(0) || "JD"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}