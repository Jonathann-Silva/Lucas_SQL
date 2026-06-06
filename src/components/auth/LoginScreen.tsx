'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { LogIn, Loader2, Package, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

/**
 * Tela de Login com autenticação por E-mail e Senha.
 * Exclusiva para acesso restrito. Redireciona para o dashboard após o sucesso.
 */
export function LoginScreen() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const appLogo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha o e-mail e a senha.",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Tenta realizar o login.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      
      toast({
        title: "Bem-vindo!",
        description: "Acesso autorizado com sucesso.",
      });

      // Redireciona para a página inicial (Dashboard)
      router.push('/');
    } catch (error: any) {
      console.warn("Tentativa de login falhou:", error.code);
      
      let message = "Não foi possível realizar o login. Verifique suas credenciais.";
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = "E-mail ou senha incorretos. Verifique os dados e tente novamente.";
          break;
        case 'auth/invalid-email':
          message = "O formato do e-mail inserido é inválido.";
          break;
        case 'auth/too-many-requests':
          message = "Muitas tentativas sem sucesso. Tente novamente em alguns minutos.";
          break;
        case 'auth/operation-not-allowed':
          message = "O login por e-mail e senha não está habilitado no seu Firebase Console.";
          break;
        default:
          message = "Ocorreu um erro ao tentar acessar o sistema. Tente novamente.";
      }
      
      toast({
        variant: "destructive",
        title: "Erro de Acesso",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md glass-panel border-primary/20 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-lg border border-border overflow-hidden">
            {appLogo ? (
              <Image 
                src={appLogo.imageUrl} 
                alt="Lucas Expresso Logo" 
                width={80} 
                height={80} 
                className="object-contain"
                data-ai-hint="motorcycle logo"
              />
            ) : (
              <Package size={40} className="text-primary" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold tracking-tighter text-primary">Lucas Expresso</CardTitle>
          <CardDescription className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">
            Painel Administrativo Restrito
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10 bg-muted/20 border-border h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Sua senha"
                  className="pl-10 bg-muted/20 border-border h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit"
              className="w-full h-12 font-bold text-base shadow-lg shadow-primary/20 mt-4" 
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-5 w-5" />
              )}
              Acessar Sistema
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50">
            <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest">
              Acesso Restrito • Lucas Expresso v2.1
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
