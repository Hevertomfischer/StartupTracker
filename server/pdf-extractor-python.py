
import os
import json
import sys
import traceback
import tempfile
import subprocess

# Função para instalar dependências se necessário
def install_package(package):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✅ Pacote {package} instalado com sucesso")
    except Exception as e:
        print(f"❌ Erro ao instalar {package}: {e}")

# Verificar e instalar dependências necessárias
required_packages = ['pdfplumber', 'pytesseract', 'pillow', 'pdf2image', 'openai', 'requests']
for package in required_packages:
    try:
        __import__(package.replace('-', '_'))
    except ImportError:
        print(f"Instalando {package}...")
        install_package(package)

# Importar após instalação
try:
    import pdfplumber
    import pytesseract
    from PIL import Image
    import openai
    import requests
    from pdf2image import convert_from_path
except ImportError as e:
    print(f"❌ Erro ao importar dependências: {e}")
    sys.exit(1)

# Configurar OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

def extract_text_from_pdf(pdf_path: str, startup_name: str) -> dict:
    """
    Extrai texto do PDF usando múltiplas estratégias com tratamento robusto de erros
    """
    print(f"=== EXTRAÇÃO PYTHON ROBUSTA ===")
    print(f"Arquivo: {pdf_path}")
    print(f"Startup: {startup_name}")
    
    if not os.path.exists(pdf_path):
        return {
            "error": f"Arquivo não encontrado: {pdf_path}",
            "extracted_text": "",
            "extraction_method": "failed",
            "analysis": {"name": startup_name, "error": "Arquivo não encontrado"}
        }
    
    file_size = os.path.getsize(pdf_path)
    print(f"Tamanho do arquivo: {file_size // 1024}KB")
    
    extracted_text = ""
    extraction_method = ""
    
    # ESTRATÉGIA 1: pdfplumber
    try:
        print("=== ESTRATÉGIA 1: PDFPLUMBER ===")
        with pdfplumber.open(pdf_path) as pdf:
            print(f"PDF aberto: {len(pdf.pages)} páginas")
            
            for i, page in enumerate(pdf.pages, start=1):
                if i > 10:  # Limitar a 10 páginas para evitar timeout
                    break
                    
                try:
                    text = page.extract_text()
                    if text and text.strip():
                        extracted_text += f"\n=== PÁGINA {i} ===\n{text}\n"
                        print(f"[página {i}] extraídos {len(text)} caracteres via texto")
                    else:
                        print(f"[página {i}] sem texto direto, tentando OCR...")
                        
                        # OCR inline com pdfplumber
                        try:
                            # Converter página para imagem
                            img = page.to_image(resolution=200)
                            
                            # Salvar temporariamente
                            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                                img.save(tmp_file.name, 'PNG')
                                
                                # OCR
                                ocr_text = pytesseract.image_to_string(tmp_file.name, lang="por+eng")
                                if ocr_text and ocr_text.strip():
                                    extracted_text += f"\n=== PÁGINA {i} (OCR) ===\n{ocr_text}\n"
                                    print(f"[página {i}] extraídos {len(ocr_text)} caracteres via OCR")
                                
                                # Limpar arquivo temporário
                                os.unlink(tmp_file.name)
                                
                        except Exception as ocr_error:
                            print(f"[página {i}] erro OCR inline: {ocr_error}")
                            
                except Exception as page_error:
                    print(f"[página {i}] erro ao processar: {page_error}")
                    continue
        
        if extracted_text.strip():
            extraction_method = "pdfplumber + OCR inline"
            print(f"✅ pdfplumber bem-sucedido: {len(extracted_text)} caracteres")
        else:
            print("⚠️ pdfplumber não conseguiu extrair texto")
            
    except Exception as pdf_error:
        print(f"❌ Erro pdfplumber: {pdf_error}")
    
    # ESTRATÉGIA 2: pdf2image + OCR completo (se pdfplumber falhou)
    if not extracted_text.strip():
        try:
            print("=== ESTRATÉGIA 2: PDF2IMAGE + TESSERACT ===")
            
            # Converter PDF para imagens (limitar a 5 páginas)
            images = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=5)
            print(f"Convertidas {len(images)} páginas para imagem")
            
            for i, image in enumerate(images, start=1):
                print(f"Processando página {i} com OCR completo...")
                
                try:
                    # Salvar temporariamente
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                        image.save(tmp_file.name, 'PNG')
                        
                        # OCR com configurações otimizadas
                        custom_config = r'--oem 3 --psm 6 -l por+eng'
                        ocr_text = pytesseract.image_to_string(tmp_file.name, config=custom_config)
                        
                        if ocr_text and ocr_text.strip():
                            extracted_text += f"\n=== PÁGINA {i} (PDF2IMAGE+OCR) ===\n{ocr_text}\n"
                            print(f"Página {i}: {len(ocr_text)} caracteres extraídos")
                        
                        # Limpar arquivo temporário
                        os.unlink(tmp_file.name)
                        
                except Exception as page_ocr_error:
                    print(f"Erro OCR na página {i}: {page_ocr_error}")
                    continue
            
            if extracted_text.strip():
                extraction_method = "pdf2image + Tesseract OCR completo"
                print(f"✅ OCR completo bem-sucedido: {len(extracted_text)} caracteres")
                
        except Exception as pdf2img_error:
            print(f"❌ Erro pdf2image+OCR: {pdf2img_error}")
    
    # ESTRATÉGIA 3: Usar comando pdftotext se disponível
    if not extracted_text.strip():
        try:
            print("=== ESTRATÉGIA 3: PDFTOTEXT ===")
            
            result = subprocess.run(['pdftotext', pdf_path, '-'], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and result.stdout.strip():
                extracted_text = result.stdout.strip()
                extraction_method = "pdftotext system command"
                print(f"✅ pdftotext extraiu {len(extracted_text)} caracteres")
            else:
                print(f"⚠️ pdftotext falhou: {result.stderr}")
                
        except Exception as pdftotext_error:
            print(f"❌ pdftotext não disponível: {pdftotext_error}")
    
    # Se ainda não temos texto, criar conteúdo baseado em metadados
    if not extracted_text.strip():
        print("❌ TODAS AS ESTRATÉGIAS FALHARAM")
        extracted_text = f"""
DOCUMENTO PDF: {os.path.basename(pdf_path)}
TAMANHO: {file_size // 1024}KB
STARTUP: {startup_name}
PROCESSADO: {json.dumps({"timestamp": "now", "python_version": sys.version})}

AVISO: Extração automática de texto falhou.
Este PDF pode estar:
- Protegido por senha
- Corrompido
- Composto principalmente por imagens escaneadas
- Em formato não suportado

RECOMENDAÇÃO: Revisar manualmente o conteúdo do pitch deck.
        """.strip()
        extraction_method = "fallback - metadados apenas"
    
    # Analisar com OpenAI
    analysis_result = analyze_with_openai(extracted_text, startup_name)
    
    return {
        "extracted_text": extracted_text,
        "extraction_method": extraction_method,
        "text_length": len(extracted_text),
        "file_size_kb": file_size // 1024,
        "analysis": analysis_result
    }

def analyze_with_openai(text: str, startup_name: str) -> dict:
    """
    Analisa o texto extraído usando OpenAI com tratamento robusto de erros
    """
    print("=== ANÁLISE AVANÇADA COM OPENAI ===")
    
    if not openai.api_key:
        print("❌ OPENAI_API_KEY não configurada")
        return {
            "name": startup_name,
            "description": f"Startup {startup_name} - análise IA não disponível (API key não configurada)",
            "error": "OpenAI API key não configurada"
        }
    
    try:
        # Truncar texto se muito longo (limite do OpenAI)
        max_chars = 12000  # Deixar espaço para o prompt
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[TEXTO TRUNCADO PARA ANÁLISE]"
            print(f"⚠️ Texto truncado para {max_chars} caracteres")
        
        prompt = f"""
Analise este texto de pitch deck de startup brasileira e extraia informações estruturadas.

NOME DA STARTUP: {startup_name}

TEXTO DO PITCH DECK:
{text}

Extraia as seguintes informações (use null se não encontrar):

RESPONDA APENAS COM JSON VÁLIDO:
{{
    "name": "{startup_name}",
    "description": "descrição do negócio baseada no pitch",
    "ceo_name": "nome do CEO/fundador se mencionado",
    "sector": "setor/indústria identificado",
    "business_model": "modelo de negócio (B2B/B2C/etc)",
    "city": "cidade se mencionada",
    "state": "estado se mencionado", 
    "website": "site se mencionado",
    "mrr": "receita recorrente mensal (apenas número)",
    "client_count": "número de clientes (apenas número)",
    "problem_solution": "problema que resolve e solução oferecida",
    "differentials": "diferenciais competitivos",
    "competitors": "concorrentes mencionados",
    "market": "mercado alvo"
}}
"""

        # Tentar com a nova API do OpenAI
        try:
            import openai
            client = openai.OpenAI(api_key=openai.api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Usar modelo mais barato e rápido
                messages=[
                    {"role": "system", "content": "Você é especialista em análise de pitch decks. Extraia informações precisas e retorne apenas JSON válido."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1500
            )
            
            result_text = response.choices[0].message.content.strip()
            
        except Exception as new_api_error:
            # Fallback para API antiga
            print(f"Tentando API antiga do OpenAI: {new_api_error}")
            
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Você é especialista em análise de pitch decks. Extraia informações precisas e retorne apenas JSON válido."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1500
            )
            
            result_text = response.choices[0].message.content.strip()
        
        # Limpar resposta se necessário
        if result_text.startswith('```json'):
            result_text = result_text.replace('```json', '').replace('```', '').strip()
        elif result_text.startswith('```'):
            result_text = result_text.replace('```', '').strip()
        
        # Tentar parsear JSON
        try:
            analysis_data = json.loads(result_text)
            
            # Garantir que o nome seja preservado
            analysis_data["name"] = startup_name
            
            print(f"✅ Análise OpenAI bem-sucedida")
            print(f"   - CEO: {analysis_data.get('ceo_name', 'N/A')}")
            print(f"   - Setor: {analysis_data.get('sector', 'N/A')}")
            print(f"   - Descrição: {len(analysis_data.get('description', '') or '')} chars")
            
            return analysis_data
            
        except json.JSONDecodeError as json_error:
            print(f"❌ Erro ao parsear JSON do OpenAI: {json_error}")
            print(f"Resposta recebida: {result_text[:500]}...")
            
            # Fallback com dados básicos
            return {
                "name": startup_name,
                "description": f"Startup {startup_name} - texto extraído mas análise JSON falhou",
                "ceo_name": None,
                "sector": None,
                "json_parse_error": str(json_error),
                "raw_response": result_text[:1000]
            }
        
    except Exception as ai_error:
        print(f"❌ Erro geral na análise OpenAI: {ai_error}")
        print(f"Traceback: {traceback.format_exc()}")
        
        return {
            "name": startup_name,
            "description": f"Startup {startup_name} - extração via Python realizada mas análise IA falhou",
            "ceo_name": None,
            "sector": None,
            "error": str(ai_error),
            "error_type": type(ai_error).__name__
        }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        error_result = {
            "error": "Uso incorreto. Sintaxe: python pdf-extractor-python.py <caminho_pdf> <nome_startup>",
            "extracted_text": "",
            "extraction_method": "failed",
            "analysis": {"error": "Argumentos incorretos"}
        }
        print(json.dumps(error_result, indent=2, ensure_ascii=False))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    startup_name = sys.argv[2]
    
    try:
        print(f"Iniciando processamento: {pdf_path} -> {startup_name}")
        result = extract_text_from_pdf(pdf_path, startup_name)
        print("✅ Processamento concluído com sucesso")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"❌ Erro crítico no processamento: {e}")
        print(f"Traceback completo: {traceback.format_exc()}")
        
        error_result = {
            "error": str(e),
            "error_type": type(e).__name__,
            "extracted_text": "",
            "extraction_method": "failed",
            "analysis": {
                "name": startup_name, 
                "error": str(e),
                "traceback": traceback.format_exc()
            }
        }
        print(json.dumps(error_result, indent=2, ensure_ascii=False))
        sys.exit(1)
