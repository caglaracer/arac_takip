from fpdf import FPDF
from PIL import Image
import os

FONTS = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
BRAIN = r"C:\Users\cagla\.gemini\antigravity\brain\5da3906e-bcd0-4229-a669-4d5fec9c1d40"
IMGS = {
    "pin": os.path.join(BRAIN, "screen_pin_lock_1775223980391.png"),
    "vehicles": os.path.join(BRAIN, "screen_vehicles_1775223992592.png"),
    "checkout": os.path.join(BRAIN, "screen_checkout_1775224011850.png"),
    "retimg": os.path.join(BRAIN, "screen_return_1775224028226.png"),
}

# Image conversion
for key, path in list(IMGS.items()):
    jpg = path.replace(".png", ".jpg")
    if not os.path.exists(jpg):
        img = Image.open(path).convert("RGB")
        img.save(jpg, "JPEG", quality=90)
    IMGS[key] = jpg

class PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_fill_color(16, 18, 24)
            self.rect(0, 0, 210, 12, 'F')
            self.set_font("Arial", "B", 8)
            self.set_text_color(240, 192, 64)
            self.cell(0, 8, "ARAC TAKIP SISTEMI - KULLANIM KILAVUZU", align="C", new_x="LMARGIN", new_y="NEXT")
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.set_text_color(128)
        self.cell(0, 10, f"Sayfa {self.page_no()}", align="C")

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=20)

# Cover Page
pdf.add_page()
pdf.set_font("Arial", "B", 24)
pdf.set_text_color(240, 192, 64)
pdf.ln(60)
pdf.cell(0, 15, "ARAC TAKIP SISTEMI", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Arial", "", 16)
pdf.set_text_color(100)
pdf.cell(0, 10, "Kullanim Kilavuzu", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(40)
pdf.set_font("Arial", "B", 10)
pdf.set_text_color(150)
pdf.cell(0, 10, "V2.0 - 2026", align="C")

# Step 1: PIN
pdf.add_page()
pdf.set_font("Arial", "B", 14)
pdf.set_text_color(240, 192, 64)
pdf.cell(0, 10, "1. Sisteme Ilk Giris", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Arial", "", 11)
pdf.set_text_color(50)
pdf.multi_cell(0, 8, "Ilk giriste 4 haneli PIN girin. Sistem sizi hatirlayacaktir.")
pdf.ln(5)
pdf.image(IMGS["pin"], x=55, w=100)

# Step 2: Vehicles
pdf.add_page()
pdf.set_font("Arial", "B", 14)
pdf.set_text_color(240, 192, 64)
pdf.cell(0, 10, "2. Araclar Ekrani", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Arial", "", 11)
pdf.set_text_color(50)
pdf.multi_cell(0, 8, "- YESIL: Musait\n- KIRMIZI: Zimmetli")
pdf.ln(5)
pdf.image(IMGS["vehicles"], x=55, w=100)

# Step 3: Checkout
pdf.add_page()
pdf.set_font("Arial", "B", 14)
pdf.set_text_color(240, 192, 64)
pdf.cell(0, 10, "3. Arac Alma", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Arial", "", 11)
pdf.set_text_color(50)
pdf.multi_cell(0, 8, "QR okutun, isminizi secin (ilk sefer), KM girin ve GONDER'e basin.")
pdf.ln(5)
pdf.image(IMGS["checkout"], x=55, w=100)

# Step 4: Return
pdf.add_page()
pdf.set_font("Arial", "B", 14)
pdf.set_text_color(240, 192, 64)
pdf.cell(0, 10, "4. Arac Teslim", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Arial", "", 11)
pdf.set_text_color(50)
pdf.multi_cell(0, 8, "QR okutun, donus KM girin ve KAYDET'e basin.")
pdf.ln(5)
pdf.image(IMGS["retimg"], x=55, w=100)

# Final
pdf.add_page()
pdf.set_font("Arial", "B", 14)
pdf.set_text_color(240, 192, 64)
pdf.cell(0, 10, "5. Uygulama Olarak Kullanma", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Arial", "", 11)
pdf.set_text_color(50)
pdf.multi_cell(0, 8, "Tarayicinizdan 'Ana Ekrana Ekle' secenegini kullanarak uygulama gibi kurabilirsiniz.")

out = r"c:\Users\cagla\arac_takip\Arac_Takip_Kullanim_Kilavuzu.pdf"
pdf.output(out)
print(f"PDF created: {out}")
