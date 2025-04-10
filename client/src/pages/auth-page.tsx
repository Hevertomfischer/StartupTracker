import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { insertUserSchema, UserRoleEnum } from "@shared/schema";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

// Formulário de login
const loginSchema = z.object({
  username: z.string().email("Email inválido"), // Passport usa 'username'
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const { loginMutation } = useAuth();
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormData) {
    // Enviamos como username por causa do Passport.js
    loginMutation.mutate({
      username: data.username,
      password: data.password
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="seu@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="******" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </Form>
  );
}

// Extensão do schema de inserção de usuário para o formulário de registro
const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

function RegisterForm() {
  const { registerMutation } = useAuth();
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: UserRoleEnum.ASSOCIATE, // Padrão para novos usuários
    },
  });

  function onSubmit(data: RegisterFormData) {
    // Remove o campo confirmPassword antes de enviar para a API
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="seu@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="******" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar Senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="******" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Perfil</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={UserRoleEnum.ADMIN}>Administrador</SelectItem>
                  <SelectItem value={UserRoleEnum.INVESTOR}>Investidor</SelectItem>
                  <SelectItem value={UserRoleEnum.ASSOCIATE}>Associado</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full" 
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registrando...
            </>
          ) : (
            "Registrar"
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, isLoading } = useAuth();

  // Redireciona para a página inicial se o usuário já estiver autenticado
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Coluna de formulário */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {activeTab === "login" ? "Entrar" : "Criar Conta"}
            </CardTitle>
            <CardDescription>
              {activeTab === "login"
                ? "Faça login para acessar o sistema"
                : "Crie uma conta para começar a usar o sistema"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Registrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            {activeTab === "login" ? (
              <>
                Não tem uma conta?{" "}
                <Button variant="link" onClick={() => setActiveTab("register")}>
                  Registre-se
                </Button>
              </>
            ) : (
              <>
                Já possui uma conta?{" "}
                <Button variant="link" onClick={() => setActiveTab("login")}>
                  Faça login
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Coluna de hero */}
      <div className="hidden md:w-1/2 md:flex flex-col bg-gradient-to-br from-primary/80 to-primary p-8 text-white">
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-4">
            Plataforma de Gestão de Startups
          </h1>
          <p className="text-xl mb-8 max-w-lg">
            A solução completa para gerenciar e acompanhar startups através de um quadro Kanban intuitivo e poderoso.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Visualização Kanban</h3>
              <p className="text-white/80">
                Organize startups por status com uma interface de arrastar e soltar intuitiva
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Histórico Detalhado</h3>
              <p className="text-white/80">
                Acompanhe todas as mudanças e transições de status de cada startup
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Gestão de Equipes</h3>
              <p className="text-white/80">
                Gerencie membros da equipe e colaboradores para cada startup
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Controle de Acesso</h3>
              <p className="text-white/80">
                Diferentes níveis de permissão para administradores, investidores e associados
              </p>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center text-white/80">
          © {new Date().getFullYear()} Startup Management Platform
        </div>
      </div>
    </div>
  );
}