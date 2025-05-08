import React, { useState, useEffect } from "react";
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
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  website: z.string().url("URL do website inválida").optional().or(z.literal("")),
  ceo_name: z.string().min(3, "Nome do CEO deve ter pelo menos 3 caracteres"),
  ceo_email: z.string().email("Email do CEO inválido"),
  ceo_phone: z.string().min(10, "Telefone do CEO deve ter pelo menos 10 caracteres"),
  industry: z.string().min(2, "Indústria deve ter pelo menos 2 caracteres"),
  founding_date: z.string().optional(),
  employee_count: z.coerce.number().int().min(1, "Número de funcionários deve ser pelo menos 1"),
  investment_stage: z.string().min(2, "Estágio de investimento deve ter pelo menos 2 caracteres"),
  annual_revenue: z.coerce.number().optional(),
  valuation: z.coerce.number().optional(),
  pitch_deck: z.any().optional(), // Aceitamos qualquer valor para o upload de arquivo
});

type FormValues = z.infer<typeof formSchema>;

export default function ExternalFormEmbed() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Função para ajustar a altura do iframe
  useEffect(() => {
    // Enviar mensagem para a janela pai com a altura do conteúdo
    const updateHeight = () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'resize',
          height: document.body.scrollHeight
        }, '*');
      }
    };

    // Atualizar altura inicial e ao redimensionar
    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    // Atualizar altura quando o estado mudar
    const observer = new MutationObserver(updateHeight);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', updateHeight);
      observer.disconnect();
    };
  }, [isSuccess]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      ceo_name: "",
      ceo_email: "",
      ceo_phone: "",
      industry: "",
      founding_date: "",
      employee_count: 1,
      investment_stage: "",
      annual_revenue: undefined,
      valuation: undefined,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      // Adicionar todos os campos de texto
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "pitch_deck" && value !== undefined) {
          formData.append(key, String(value));
        }
      });
      
      // Adicionar pitch deck se presente
      if (data.pitch_deck && data.pitch_deck.length > 0) {
        formData.append('pitch_deck', data.pitch_deck[0]);
      }

      const response = await fetch('/api/external/startup', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Erro ao cadastrar startup");
      }

      setIsSuccess(true);
      toast({
        title: "Cadastro realizado com sucesso",
        description: "Sua startup foi cadastrada e será analisada em breve.",
        variant: "default",
      });

      // Informar a janela pai que o formulário foi enviado com sucesso
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'formSubmitted',
          result: result
        }, '*');
      }
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
      <div className="py-10">
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
    <div className="py-6">
      <Card className="max-w-full">
        <CardHeader>
          <CardTitle className="text-center text-xl">Cadastro de Startup</CardTitle>
          <CardDescription className="text-center">
            Preencha o formulário abaixo para cadastrar sua startup em nossa plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-base font-medium">Informações da Startup</h3>
                <Separator />
                
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição da Startup *</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={3}
                          placeholder="Descreva brevemente sua startup, produto/serviço e proposta de valor"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://www.example.com" />
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
                        <FormLabel>Indústria/Setor *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Fintech, Healthtech, Edtech" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="founding_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Fundação</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
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
                        <FormLabel>Número de Funcionários *</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={1} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Informações do CEO/Fundador</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="ceo_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do CEO/Fundador *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ceo_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email do CEO/Fundador *</FormLabel>
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
                        <FormLabel>Telefone do CEO/Fundador *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Informações Financeiras</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="investment_stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estágio de Investimento *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Seed, Series A, Bootstrapped" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="annual_revenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receita Anual (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min={0} 
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

                  <FormField
                    control={form.control}
                    name="valuation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valuation (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min={0}
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
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-medium">Documentos</h3>
                <Separator />

                <FormItem className="space-y-2">
                  <FormLabel>Pitch Deck</FormLabel>
                  <div>
                    <Input 
                      type="file" 
                      accept=".pdf,.ppt,.pptx" 
                      onChange={(e) => {
                        form.setValue('pitch_deck', e.target.files);
                      }}
                    />
                  </div>
                  <FormDescription>
                    Envie uma apresentação em formato PDF ou PowerPoint (máx. 10MB)
                  </FormDescription>
                  {form.formState.errors.pitch_deck?.message && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.pitch_deck.message.toString()}
                    </p>
                  )}
                </FormItem>
              </div>

              <div className="flex justify-center mt-5">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
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