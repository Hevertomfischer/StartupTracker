
import os
import json
import sys
import pdfplumber
import pytesseract
from PIL import Image
import openai
import requests
import io
from pdf2image import convert_from_path
import tempfile

# Configurar OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

def extract_text_from_pdf(pdf_path: str, startup_name: str) -> dict:
    """
    Extrai texto do PDF usando múltiplas estratégias
    """
    print(f"=== EXTRAINDO TEXTO DO PDF PYTHON ===")
    print(f"Arquivo: {pdf_path}")
    print(f"Startup: {startup_name}")
    
    extracted_text = ""
    extraction_method = ""
    
    try:
        # Estratégia 1: pdfplumber
        print("=== TENTATIVA 1: PDFPLUMBER ===")
        with pdfplumber.open(pdf_path) as pdf:
            print(f"PDF aberto: {len(pdf.pages)} páginas")
            
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text()
                if text and text.strip():
                    extracted_text += f"\n=== PÁGINA {i} ===\n{text}\n"
                    print(f"[página {i}] extraídos {len(text)} caracteres via texto")
                else:
                    print(f"[página {i}] sem texto - tentando OCR")
                    
                    # Estratégia 2: OCR com pytesseract
                    try:
                        img = page.to_image(resolution=300).original
                        ocr_text = pytesseract.image_to_string(img, lang="por+eng")
                        if ocr_text and ocr_text.strip():
                            extracted_text += f"\n=== PÁGINA {i} (OCR) ===\n{ocr_text}\n"
                            print(f"[página {i}] extraídos {len(ocr_text)} caracteres via OCR")
                    except Exception as ocr_error:
                        print(f"[página {i}] erro OCR: {ocr_error}")
        
        if extracted_text.strip():
            extraction_method = "pdfplumber + OCR"
            print(f"✅ Extração bem-sucedida: {len(extracted_text)} caracteres")
        else:
            print("⚠️ pdfplumber não conseguiu extrair texto")
            
    except Exception as pdf_error:
        print(f"❌ Erro pdfplumber: {pdf_error}")
    
    # Estratégia 3: pdf2image + OCR completo
    if not extracted_text.strip():
        try:
            print("=== TENTATIVA 2: PDF2IMAGE + OCR ===")
            
            # Converter PDF para imagens
            images = convert_from_path(pdf_path, dpi=200, first_page=1, last_page=5)  # Máximo 5 páginas
            print(f"Convertidas {len(images)} páginas para imagem")
            
            for i, image in enumerate(images, start=1):
                print(f"Processando página {i} com OCR...")
                
                # Salvar temporariamente
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                    image.save(tmp_file.name, 'PNG')
                    
                    # OCR
                    ocr_text = pytesseract.image_to_string(tmp_file.name, lang="por+eng")
                    if ocr_text and ocr_text.strip():
                        extracted_text += f"\n=== PÁGINA {i} (PDF2IMAGE+OCR) ===\n{ocr_text}\n"
                        print(f"Página {i}: {len(ocr_text)} caracteres extraídos")
                    
                    # Limpar arquivo temporário
                    os.unlink(tmp_file.name)
            
            if extracted_text.strip():
                extraction_method = "pdf2image + OCR"
                print(f"✅ PDF2IMAGE+OCR bem-sucedido: {len(extracted_text)} caracteres")
                
        except Exception as pdf2img_error:
            print(f"❌ Erro pdf2image+OCR: {pdf2img_error}")
    
    # Se ainda não temos texto, criar fallback básico
    if not extracted_text.strip():
        print("❌ TODAS AS ESTRATÉGIAS FALHARAM")
        file_size = os.path.getsize(pdf_path)
        extracted_text = f"""
DOCUMENTO PDF: {os.path.basename(pdf_path)}
TAMANHO: {file_size // 1024}KB
STARTUP: {startup_name}

AVISO: Não foi possível extrair texto automaticamente deste PDF.
Este documento requer revisão manual para extração das informações.
        """.strip()
        extraction_method = "fallback - sem texto extraído"
    
    # Analisar com OpenAI
    analysis_result = analyze_with_openai(extracted_text, startup_name)
    
    return {
        "extracted_text": extracted_text,
        "extraction_method": extraction_method,
        "text_length": len(extracted_text),
        "analysis": analysis_result
    }

def analyze_with_openai(text: str, startup_name: str) -> dict:
    """
    Analisa o texto extraído usando OpenAI
    """
    print("=== ANALISANDO COM OPENAI ===")
    
    try:
        prompt = f"""
Extraia as principais informações do seguinte texto de pitch deck para criar um registro estruturado de startup:

TEXTO EXTRAÍDO:
{text}

NOME DA STARTUP: {startup_name}

Retorne APENAS um JSON válido com os seguintes campos (use null para campos não encontrados):
{{
    "name": "{startup_name}",
    "description": "descrição do negócio",
    "ceo_name": "nome do CEO ou founder",
    "sector": "setor/indústria",
    "business_model": "modelo de negócio",
    "city": "cidade",
    "state": "estado",
    "website": "site da empresa",
    "mrr": numero_mrr,
    "client_count": numero_clientes,
    "problem_solution": "problema que resolve e solução",
    "differentials": "diferenciais competitivos",
    "competitors": "principais concorrentes",
    "market": "mercado alvo"
}}

Responda APENAS com o JSON:"""

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Você é especialista em análise de pitch decks. Extraia APENAS informações reais do texto."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1500
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Limpar JSON se necessário
        if result_text.startswith('```json'):
            result_text = result_text.replace('```json', '').replace('```', '').strip()
        
        analysis_data = json.loads(result_text)
        print(f"✅ Análise OpenAI bem-sucedida")
        return analysis_data
        
    except Exception as ai_error:
        print(f"❌ Erro OpenAI: {ai_error}")
        return {
            "name": startup_name,
            "description": f"Startup {startup_name} processada via Python - análise IA falhou",
            "ceo_name": None,
            "sector": None,
            "error": str(ai_error)
        }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python pdf-extractor-python.py <caminho_pdf> <nome_startup>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    startup_name = sys.argv[2]
    
    try:
        result = extract_text_from_pdf(pdf_path, startup_name)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        error_result = {
            "error": str(e),
            "extracted_text": "",
            "extraction_method": "failed",
            "analysis": {"name": startup_name, "error": str(e)}
        }
        print(json.dumps(error_result, indent=2, ensure_ascii=False))
