import { Resend, ErrorResponse } from 'resend';

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
export async function sendEmail(emailData: EmailData): Promise<{success: boolean, testMode?: boolean, testRecipient?: string}> {
  const { to, subject, body, from } = emailData;
  
  console.log('==== DETALHES DO ENVIO DE E-MAIL ====');
  console.log(`API Key (primeiros 5 chars): ${process.env.RESEND_API_KEY?.substring(0, 5)}...`);
  console.log(`Para: ${to}`);
  console.log(`Assunto: ${subject}`);
  console.log(`Tamanho do corpo: ${body.length} caracteres`);
  
  try {
    // Determinar o remetente (usar um domínio verificado no Resend é importante)
    // O formato padrão do Resend é "Nome <onboarding@resend.dev>"
    const defaultFrom = 'StartupOS <onboarding@resend.dev>';
    const fromAddress = from || defaultFrom;

    console.log(`Tentando enviar e-mail de ${fromAddress} para: ${to}`);
    
    // Verificar o ambiente - em modo de teste, sempre enviar para o email da conta Resend
    const isTestMode = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const verifiedEmail = 'contato@scventures.capital'; // Email verificado na conta Resend
    
    // Criar payload de envio
    const payload = {
      from: fromAddress,
      to: isTestMode ? [verifiedEmail] : [to], // Em modo de teste, sempre envia para o email verificado
      subject: isTestMode ? `[TESTE - Destino original: ${to}] ${subject}` : subject,
      html: isTestMode 
        ? `<div style="background-color: #ffe0e0; padding: 10px; margin-bottom: 20px; border: 1px solid #ff0000;">
             <strong>MODO DE TESTE:</strong> Este email seria enviado para <strong>${to}</strong><br/>
             Para enviar para outros destinatários, verifique um domínio no Resend.
           </div>
           ${body}`
        : body,
    };
    
    console.log('Payload de envio:', JSON.stringify(payload, null, 2));
    
    // Enviar o e-mail através do Resend
    console.log('Chamando API Resend...');
    const result = await resend.emails.send(payload);
    console.log('Resposta completa do Resend:', JSON.stringify(result, null, 2));
    
    const { data, error } = result;

    if (error) {
      console.error('Erro retornado pelo Resend:', JSON.stringify(error));
      
      // Utilizar o tipo correto para ErrorResponse
      const resendError = error as ErrorResponse;
      console.error('Código:', resendError.statusCode || 'Não disponível');
      console.error('Mensagem:', resendError.message || 'Erro desconhecido');
      
      // Para lidar com o erro de domínio não verificado, informar claramente no log
      if (resendError.message && resendError.message.includes('verify a domain')) {
        console.error('ERRO DE VERIFICAÇÃO DE DOMÍNIO: O Resend requer um domínio verificado para enviar e-mails para outros destinatários.');
        console.error('Em modo de teste, apenas e-mails para "contato@scventures.capital" são permitidos.');
      }
      
      return false;
    }

    console.log('E-mail enviado com sucesso através do Resend:', data?.id);
    return true;
  } catch (error: any) {
    console.error('Exceção ao enviar e-mail com Resend:', error);
    if (error.message) {
      console.error('Mensagem de erro:', error.message);
    }
    if (error.response) {
      console.error('Detalhes da resposta:', error.response);
    }
    return false;
  } finally {
    console.log('==== FIM DO ENVIO DE E-MAIL ====');
  }
}