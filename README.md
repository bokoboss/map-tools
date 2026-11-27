# Web App ปักหมุดและวาดแผนที่ (Map Annotation Tool)

<img width="1097" height="656" alt="image" src="https://github.com/user-attachments/assets/5140edd7-a3b9-46c2-be42-8ec3b4cbe066" />


เว็บแอปพลิเคชันสำหรับสร้างและจัดการข้อมูลบนแผนที่ (Geospatial Annotation) สร้างขึ้นด้วยเทคโนโลยีเว็บมาตรฐาน (HTML, CSS, JavaScript) และไลบรารีแผนที่ Leaflet.js ผู้ใช้สามารถปักหมุด, วาดรูปทรง, วัดระยะทาง/พื้นที่, เพิ่มข้อความ และจัดการข้อมูลต่างๆ ได้อย่างง่ายดายผ่านหน้าเว็บ

**[➡️ ไปที่หน้าเว็บแอปพลิเคชัน (Live Demo)](https://bokoboss.github.io/map-tools/)**

---

## ✨ คุณสมบัติหลัก (Key Features)

* **📍 หมุดและวงรัศมี:** หมุดพร้อมวงรัศมีหลายวงต่อหมุด แต่ละวงกำหนดระยะและสีได้ ลากย้ายได้ ไม่บังคับใส่ชื่อ
* **🚦 ประเภทจุดสำรวจ:** แยกสัญญาณไฟ / แยกไม่มีสัญญาณไฟ (TMC) จุดกลับรถ (UT) นับรถบนช่วงถนน (MB) นับคนเดิน (PC) จุดสำรวจ OD และหมุดทั่วไป พร้อมรหัสรันเลขอัตโนมัติ ป้ายรหัสข้างสัญลักษณ์ และคำอธิบายสัญลักษณ์บนแผนที่
* **⚡ ปักหมุดเร็ว:** เลือกประเภทแล้วคลิกบนแผนที่ทีละจุด ไม่มีหน้าต่างเด้ง
* **📐 วาดและวัด:** เส้น รูปหลายเหลี่ยม สี่เหลี่ยม วงกลม ลูกศร ข้อความ (หมุนได้) พร้อมระยะทางและพื้นที่ (ตร.ม. / ไร่-งาน-ตร.วา)
* **🖼️ ภาพสำหรับรายงาน:** A4/A3 แนวนอนหรือแนวตั้ง 150–300 dpi พร้อมชื่อแผนที่ ลูกศรทิศเหนือ มาตราส่วน และคำอธิบายสัญลักษณ์
* **🗺️ แผนที่พื้นหลัง:** แผนที่ raster หลายแบบ และแผนที่ vector ฟรี 7 แบบ (MapLibre / OpenFreeMap / VersaTiles) รวมแบบสว่างและมืด ชื่อสถานที่ภาษาไทย ภาพส่งออกคมชัด
* **💾 ข้อมูล:** บันทึก/เปิดโปรเจกต์ `.json` บันทึกอัตโนมัติในเบราว์เซอร์ ย้อนกลับ/ทำซ้ำ (Ctrl+Z / Ctrl+Y) นำเข้า/ส่งออก CSV และส่งออก KML (Google Earth / My Maps)

รายละเอียดการใช้งานทั้งหมด: [docs/APP_GUIDE.md](docs/APP_GUIDE.md)

---

## 🚀 วิธีใช้งานเบื้องต้น

1. **เพิ่มหมุด:** คลิกขวาบนแผนที่ → "เพิ่มหมุดที่นี่" หรือเปิดกล่องเครื่องมือ (⚙️) แล้วกดปุ่มสายฟ้าเพื่อปักหมุดเร็ว
2. **วงรัศมี:** คลิกขวาที่หมุด → "จัดการรัศมี"
3. **วาดรูปทรง:** เปิดกล่องเครื่องมือ (⚙️) แล้วเลือกเครื่องมือ
4. **แก้ไข:** ดับเบิลคลิกที่หมุดหรือข้อความ หรือคลิกขวาที่วัตถุ
5. **ค้นหาพิกัด:** วาง `13.7466, 100.5393` ในช่องค้นหา

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

* HTML / CSS / JavaScript ไฟล์เดียว ไม่ต้อง build
* [Leaflet](https://leafletjs.com/) 1.9.4 + [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) 1.0.4
* [MapLibre GL JS](https://maplibre.org/) 5.24.1 + [maplibre-gl-leaflet](https://github.com/maplibre/maplibre-gl-leaflet) 0.1.4 กับสไตล์จาก [OpenFreeMap](https://openfreemap.org/) (โหลดเมื่อเลือกใช้เท่านั้น)
* [modern-screenshot](https://github.com/qq15725/modern-screenshot) 4.7.0 และ [html2canvas](https://html2canvas.hertzen.com/) 1.4.1 สำหรับส่งออกภาพ
* [Tailwind CSS](https://tailwindcss.com/) (Play CDN), [iro.js](https://iro.js.org/), ฟอนต์ Sarabun

---

## 📂 รันในเครื่องและทดสอบ

```bash
git clone https://github.com/bokoboss/map-tools.git
cd map-tools
python -m http.server 8000      # แล้วเปิด http://localhost:8000/
```

ทดสอบอัตโนมัติ (Playwright, ต้องต่ออินเทอร์เน็ต):

```bash
cd tests/e2e
npm install
npx playwright install chromium
npm test
```

> เวอร์ชัน v2 (Vite / TypeScript) ที่พักไว้ เก็บอยู่ใน branch `archive/v2-vite`
> ลิงก์เดิม `/map-tools/classic/` จะพามาที่หน้าหลักอัตโนมัติ

---

## 📄 สัญญาอนุญาต (License)

โปรเจกต์นี้อยู่ภายใต้สัญญาอนุญาตแบบ MIT - ดูรายละเอียดเพิ่มเติมได้ที่ไฟล์ `LICENSE`
</markdown>
