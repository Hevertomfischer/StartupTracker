import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  ceo_name: z.string().min(3, "Nome do CEO deve ter pelo menos 3 caracteres"),
  ceo_email: z.string().email("Email do CEO inválido"),
  ceo_phone: z.string().min(10, "Telefone deve ter pelo menos 10 caracteres"),
  business_model: z.string().min(2, "Modelo de Negócios deve ter pelo menos 2 caracteres"),
  industry: z.string().min(2, "Solução para o Problema deve ter pelo menos 2 caracteres"),
  differentials: z.string().min(10, "Diferenciais da Startup deve ter pelo menos 10 caracteres"),
  employee_count: z.coerce.number().int().min(1, "Número de funcionários deve ser pelo menos 1"),
  sector: z.string().min(2, "Setor deve ter pelo menos 2 caracteres"),
  city: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().min(2, "Estado deve ter pelo menos 2 caracteres"),
  website: z.string().url("URL do website inválida").optional().or(z.literal("")),
  pitch_deck: z.any().optional(),
  valuation: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ExternalForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      ceo_name: "",
      ceo_email: "",
      ceo_phone: "",
      business_model: "",
      industry: "",
      differentials: "",
      employee_count: 1,
      sector: "",
      city: "",
      state: "",
      website: "",
      valuation: undefined,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      console.log("Dados do formulário antes do envio:", data);
      
      const formData = new FormData();
      
      // Adicionar todos os campos de texto
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "pitch_deck" && value !== undefined) {
          console.log(`Adicionando campo ${key}:`, value);
          formData.append(key, String(value));
        }
      });
      
      // Adicionar pitch deck se presente
      if (data.pitch_deck && data.pitch_deck.length > 0) {
        console.log("Adicionando arquivo pitch_deck:", data.pitch_deck[0].name);
        formData.append('pitch_deck', data.pitch_deck[0]);
      } else {
        console.log("ERRO: Nenhum arquivo pitch_deck encontrado!");
        throw new Error("Por favor, selecione um arquivo para o Pitch Deck.");
      }

      console.log("Enviando requisição para /api/external/startup");

      const response = await fetch('/api/external/startup', {
        method: 'POST',
        body: formData,
      });

      console.log("Response status:", response.status);
      const result = await response.json();
      console.log("Response data:", result);
      
      if (!response.ok) {
        throw new Error(result.message || "Erro ao cadastrar startup");
      }

      setIsSuccess(true);
      toast({
        title: "Cadastro realizado com sucesso",
        description: "Sua startup foi cadastrada e será analisada em breve.",
        variant: "default",
      });
    } catch (error) {
      console.error("Erro ao enviar formulário:", error);
      toast({
        title: "Erro ao cadastrar startup",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="container py-10">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Cadastro Realizado com Sucesso</CardTitle>
            <CardDescription className="text-center">
              Obrigado por cadastrar sua startup! Nossa equipe irá analisar suas informações em breve.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p>Um email de confirmação foi enviado para o endereço fornecido.</p>
            <Button 
              onClick={() => {
                setIsSuccess(false);
                form.reset();
              }}
            >
              Cadastrar Nova Startup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Cadastro de Startup</CardTitle>
          <CardDescription className="text-center">
            Preencha o formulário abaixo para cadastrar sua startup em nossa plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Startup *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ceo_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome CEO *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ceo_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail CEO *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ceo_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Whatsapp CEO *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Problema que Resolve *</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Solução para o Problema *</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="differentials"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diferenciais da Startup *</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funcionários ativos hoje (MÊS) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo de Negócios *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Setor de atuação" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site da Startup</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://www.example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pitch_deck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pitch Deck *</FormLabel>
                    <FormControl>
                      <Input 
                        type="file" 
                        accept=".pdf,.ppt,.pptx" 
                        onChange={(e) => {
                          field.onChange(e.target.files);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Arquivos permitidos: PDF, PowerPoint
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valuation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valuation</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min={0}
                        placeholder="Qual é o valor da sua startup? (Valuation R$ milhões)"
                        onChange={(e) => {
                          const value = e.target.value === "" ? undefined : Number(e.target.value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center mt-6">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isSubmitting}
                  className="w-full md:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Cadastrar Startup"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}