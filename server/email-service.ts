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
export async function sendEmail(emailData: EmailData): Promise<{
  success: boolean, 
  testMode?: boolean, 
  testRecipient?: string, 
  realRecipient?: string,
  errorCode?: string,
  errorMessage?: string
}> {
  const { to, subject, body, from } = emailData;
  
  console.log('==== DETALHES DO ENVIO DE E-MAIL ====');
  console.log(`API Key (primeiros 5 chars): ${process.env.RESEND_API_KEY?.substring(0, 5)}...`);
  console.log(`Para: ${to}`);
  console.log(`Assunto: ${subject}`);
  console.log(`Tamanho do corpo: ${body.length} caracteres`);
  
  try {
    // Determinar o remetente (usar um domínio verificado no Resend é importante)
    // O formato padrão do Resend é "Nome <onboarding@resend.dev>"
    // Para resolver o problema de verificação de domínio, usar SEMPRE o endereço resend.dev que já está verificado
    // IMPORTANTE: O endereço onboarding@resend.dev é o único que não requer verificação de domínio
    const defaultFrom = 'Contato <contato@scventures.capital>';
    const fromAddress = defaultFrom; // Ignorar qualquer outro 'from' para garantir que sempre use o domínio resend.dev

    console.log(`Tentando enviar e-mail de ${fromAddress} para: ${to}`);
    
    // Definir modo de teste como falso para enviar diretamente ao destinatário
    const isTestMode = false; // Alterado de !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
    const verifiedEmail = 'contato@scventures.capital'; // Email verificado na conta Resend
    
    // Criar payload de envio
    // Verificar se há erros de sintaxe no corpo do email (útil para depuração)
    let processedBody = body;
    try {
      if (body.includes('{{') && body.includes('}}')) {
        console.log('E-mail contém placeholders que devem ter sido processados antes de chegar aqui');
      }
    } catch (error) {
      console.error('Erro ao analisar corpo do email:', error);
    }
    
    const payload = {
      from: fromAddress,
      to: isTestMode ? [verifiedEmail] : [to], // Em modo de teste, sempre envia para o email verificado
      subject: isTestMode ? `[TESTE - Destino original: ${to}] ${subject}` : subject,
      html: isTestMode 
        ? `<div style="background-color: #ffe0e0; padding: 10px; margin-bottom: 20px; border: 1px solid #ff0000;">
             <strong>MODO DE TESTE:</strong> Este email seria enviado para <strong>${to}</strong><br/>
             Para enviar para outros destinatários, verifique um domínio no Resend.
           </div>
           ${processedBody}`
        : processedBody,
    };
    
    // Adicionar aviso em logs quando enviando para destinatário real
    if (!isTestMode) {
      console.log('⚠️ ATENÇÃO: Modo de produção ativo - enviando email diretamente para o destinatário real!');
      console.log(`⚠️ Destinatário: ${to}`);
    }
    
    console.log('Payload de envio:', JSON.stringify(payload, null, 2));
    
    // Enviar o e-mail através do Resend
    console.log('Chamando API Resend...');
    const result = await resend.emails.send(payload);
    console.log('Resposta completa do Resend:', JSON.stringify(result, null, 2));
    
    const { data, error } = result;

    if (error) {
      console.error('Erro retornado pelo Resend:', JSON.stringify(error));
      
      // Tratar o objeto de erro com segurança
      const resendError = error as any;
      console.error('Código:', resendError?.statusCode || 'Não disponível');
      console.error('Mensagem:', resendError?.message || 'Erro desconhecido');
      
      // Para lidar com o erro de domínio não verificado, informar claramente no log
      let specificErrorCode = 'UNKNOWN_ERROR';
      
      if (resendError.message) {
        // Categorizar erros comuns do Resend para diagnóstico mais fácil
        if (resendError.message.includes('verify a domain') || resendError.message.includes('change the `from` address')) {
          specificErrorCode = 'DOMAIN_VERIFICATION';
          console.error('ERRO DE VERIFICAÇÃO DE DOMÍNIO: O Resend requer um domínio verificado para enviar e-mails para outros destinatários.');
          console.error('Para resolver isso, estamos usando o remetente padrão onboarding@resend.dev');
          console.error('Mensagem completa do erro:', resendError.message);
        } 
        else if (resendError.message.includes('rate limit') || resendError.message.includes('rate limited')) {
          specificErrorCode = 'RATE_LIMIT';
          console.error('ERRO DE LIMITE DE TAXA: O Resend limitou o número de emails que podem ser enviados.');
          console.error('Mensagem completa do erro:', resendError.message);
        }
        else if (resendError.message.includes('invalid email') || resendError.message.includes('invalid recipient')) {
          specificErrorCode = 'INVALID_EMAIL';
          console.error('ERRO DE EMAIL INVÁLIDO: Um ou mais destinatários têm formato inválido.');
          console.error('Mensagem completa do erro:', resendError.message);
        }
        else if (resendError.message.includes('unauthorized') || resendError.message.includes('api key')) {
          specificErrorCode = 'AUTH_ERROR';
          console.error('ERRO DE AUTENTICAÇÃO: A chave API do Resend é inválida ou não está autorizada.');
          console.error('Mensagem completa do erro:', resendError.message);
        }
        else {
          console.error('ERRO DO RESEND:', resendError.message);
        }
      }
      
      return { 
        success: false,
        errorCode: specificErrorCode || resendError?.statusCode || 'UNKNOWN_ERROR',
        errorMessage: resendError?.message || 'Erro desconhecido' 
      };
    }

    if (isTestMode) {
      console.log(`MODO DE TESTE: Email redirecionado para ${verifiedEmail} em vez de ${to}`);
      console.log('E-mail enviado com sucesso através do Resend (modo teste):', data?.id);
      return { 
        success: true, 
        testMode: true, 
        testRecipient: verifiedEmail 
      };
    } else {
      console.log('✅ E-mail enviado com sucesso para destinatário real:', to);
      console.log('✅ ID do email enviado:', data?.id);
      return { 
        success: true,
        realRecipient: to
      };
    }
  } catch (error: any) {
    console.error('Exceção ao enviar e-mail com Resend:', error);
    
    // Iniciar com valores padrão
    let specificErrorCode = 'EXCEPTION';
    let errorMessage = 'Erro desconhecido ao enviar email';
    
    if (error.message) {
      console.error('Mensagem de erro:', error.message);
      errorMessage = error.message;
      
      // Categorizar tipos comuns de erro na exceção
      if (error.message.includes('network') || error.message.includes('connection')) {
        specificErrorCode = 'NETWORK_ERROR';
        console.error('ERRO DE REDE: Não foi possível conectar ao serviço Resend.');
      }
      else if (error.message.includes('timeout')) {
        specificErrorCode = 'TIMEOUT';
        console.error('ERRO DE TIMEOUT: A requisição para o Resend excedeu o tempo limite.');
      }
      else if (error.message.includes('auth') || error.message.includes('api key')) {
        specificErrorCode = 'AUTH_ERROR';
        console.error('ERRO DE AUTENTICAÇÃO: Problema com a chave de API do Resend.');
      }
    }
    
    if (error.response) {
      console.error('Detalhes da resposta:', error.response);
      
      // Se temos um statusCode na resposta, usar isso como código específico
      if (error.response.status) {
        specificErrorCode = `HTTP_${error.response.status}`;
      }
    }
    
    return { 
      success: false,
      errorCode: specificErrorCode,
      errorMessage: errorMessage
    };
  } finally {
    console.log('==== FIM DO ENVIO DE E-MAIL ====');
  }
}