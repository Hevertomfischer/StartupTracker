import nodemailer from 'nodemailer';

// Configuração do transporter do Nodemailer usando variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST?.trim(),
  port: parseInt(process.env.EMAIL_PORT?.trim() || '587'),
  secure: process.env.EMAIL_PORT?.trim() === '465', // true para porta 465, false para outras portas
  auth: {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASSWORD?.trim(),
  },
});

// Verificar conexão com o servidor de e-mail na inicialização
transporter.verify((error, success) => {
  if (error) {
    console.error('Erro na configuração do servidor de email:', error);
  } else {
    console.log('Servidor de email está pronto para enviar mensagens');
  }
});

// Interface para dados do e-mail
export interface EmailData {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

/**
 * Envia um e-mail usando as configurações definidas
 * @param emailData Dados do e-mail a ser enviado
 * @returns Promise com resultado do envio
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  const { to, subject, body, from } = emailData;
  
  try {
    // Usa o e-mail configurado como remetente padrão se não for especificado
    const mailOptions = {
      from: from || process.env.EMAIL_USER,
      to,
      subject,
      html: body, // Suporta HTML
    };

    console.log(`Tentando enviar e-mail para: ${to}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado com sucesso:', info.messageId);
    return true;
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return false;
  }
}