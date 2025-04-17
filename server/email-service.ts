import { Resend } from 'resend';

// Verificar se a API key foi definida
if (!process.env.RESEND_API_KEY) {
  console.error('ERRO: RESEND_API_KEY não está definida nas variáveis de ambiente');
}

// Inicializar o cliente Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Verificar a configuração do Resend na inicialização
async function verifyResendConfig() {
  try {
    // Apenas verifica se a chave parece válida (não é vazia e tem o formato correto)
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.length < 30) {
      console.error('ERRO: RESEND_API_KEY inválida ou muito curta');
      return;
    }
    
    console.log('Configuração do Resend inicializada');
  } catch (error) {
    console.error('Erro na configuração do Resend:', error);
  }
}

// Verificar a configuração na inicialização
verifyResendConfig();

// Interface para dados do e-mail
export interface EmailData {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

/**
 * Envia um e-mail usando o Resend
 * @param emailData Dados do e-mail a ser enviado
 * @returns Promise com resultado do envio
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  const { to, subject, body, from } = emailData;
  
  try {
    // Determinar o remetente (usar um domínio verificado no Resend é importante)
    // O formato padrão do Resend é "Nome <onboarding@resend.dev>"
    const defaultFrom = 'StartupOS <onboarding@resend.dev>';
    const fromAddress = from || defaultFrom;

    console.log(`Tentando enviar e-mail de ${fromAddress} para: ${to}`);
    
    // Enviar o e-mail através do Resend
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: body,
    });

    if (error) {
      console.error('Erro retornado pelo Resend:', error);
      return false;
    }

    console.log('E-mail enviado com sucesso através do Resend:', data?.id);
    return true;
  } catch (error) {
    console.error('Erro ao enviar e-mail com Resend:', error);
    return false;
  }
}