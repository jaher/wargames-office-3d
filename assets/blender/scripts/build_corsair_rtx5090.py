#!/usr/bin/env python3
"""Build a studio-grade Corsair 5000D Airflow + NVIDIA GeForce RTX 5090 Founders Edition in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js in the browser — ZERO Blender Cycles rendering!).
Crafted to match real product photographs of:
- Corsair 5000D Airflow Mid-Tower (245 x 520 x 520 mm + 22 mm sculpted angled feet)
- NVIDIA GeForce RTX 5090 Founders Edition (304 x 137 x 36 mm true 2-slot double flow-through)
- ATX PRO Z890-A WIFI motherboard with rich 3D VRM heatsinks, I/O armor, M.2 shields, PCIe slots, capacitors & braided cables
- Corsair iCUE LINK H150i LCD 360mm AIO with corrugated radiator fin core, front end-tank, knurled rotary fittings & braided hoses
- 7x 120mm Corsair RGB fans with true curved bmesh airfoil blades & smooth 64-segment rings
"""
import math
import os
import random
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler
from PIL import Image, ImageDraw, ImageFont, ImageFilter

MM = 0.001
CASE_W = 245.0 * MM
CASE_D = 520.0 * MM
CASE_H = 520.0 * MM
FOOT_H = 26.0 * MM  # Authentic Corsair 5000D ~26mm angled desk clearance

GPU_L = 304.0 * MM
GPU_W = 137.0 * MM
GPU_H = 28.0 * MM  # Razor-sleek authentic 2-slot RTX 5090 Founders Edition unibody profile

OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def eval_cubic_bezier(p0, p1, p2, p3, t):
    u = 1.0 - t
    return tuple(
        (u ** 3) * p0[i] + 3 * (u ** 2) * t * p1[i] + 3 * u * (t ** 2) * p2[i] + (t ** 3) * p3[i]
        for i in range(3)
    )


def eval_cubic_bezier_tangent(p0, p1, p2, p3, t):
    u = 1.0 - t
    v = Vector((
        3 * (u ** 2) * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * (t ** 2) * (p3[0] - p2[0]),
        3 * (u ** 2) * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * (t ** 2) * (p3[1] - p2[1]),
        3 * (u ** 2) * (p1[2] - p0[2]) + 6 * u * t * (p2[2] - p1[2]) + 3 * (t ** 2) * (p3[2] - p2[2]),
    ))
    return v.normalized()


def generate_textures():
    try:
        f_xl = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 86)
        f_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
        f_md = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38)
        f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 26)
        f_xs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 18)
    except Exception:
        f_xl = f_lg = f_md = f_sm = f_xs = ImageFont.load_default()

    # 1. 2x-Supersampled Anti-Aliased Corsair 5000D Stamped Steel Triangular Airflow Mesh (smooth alpha edges -> ZERO moiré!)
    gw, gh = 1024, 2048
    ss = 2
    grille_front_hi = Image.new("RGBA", (gw * ss, gh * ss), (62, 68, 78, 255))
    grille_top_hi = Image.new("RGBA", (gw * ss, gh * ss), (68, 74, 84, 255))
    gdf = ImageDraw.Draw(grille_front_hi)
    gdt = ImageDraw.Draw(grille_top_hi)
    gdt.rectangle((0, 0, gw * ss - 1, gh * ss - 1), outline=(30, 34, 40, 255), width=42)
    step_x, step_y = 60 * ss, 52 * ss
    for row in range(int((gh * ss) / step_y) + 2):
        for col in range(int((gw * ss) / step_x) + 2):
            cx = col * step_x + (step_x * 0.5 if row % 2 else 0)
            cy = row * step_y
            if cx < 46 * ss or cx > (gw - 46) * ss or cy < 46 * ss or cy > (gh - 46) * ss:
                continue
            pts_f = [(cx, cy - 16.0 * ss), (cx + 18.4 * ss, cy + 14.0 * ss), (cx - 18.4 * ss, cy + 14.0 * ss)]
            pts_t = [(cx, cy - 16.8 * ss), (cx + 19.2 * ss, cy + 14.6 * ss), (cx - 19.2 * ss, cy + 14.6 * ss)]
            gdf.polygon([(cx, cy - 14.2 * ss), (cx + 20.0 * ss, cy + 15.6 * ss), (cx - 20.0 * ss, cy + 15.6 * ss)], fill=(86, 94, 106, 255))
            gdf.polygon(pts_f, fill=(0, 0, 0, 0))
            gdt.polygon([(cx, cy - 14.8 * ss), (cx + 20.8 * ss, cy + 16.2 * ss), (cx - 20.8 * ss, cy + 16.2 * ss)], fill=(104, 112, 126, 255))
            gdt.polygon(pts_t, fill=(0, 0, 0, 0))
    grille_front = grille_front_hi.resize((gw, gh), Image.Resampling.LANCZOS)
    grille_top = grille_top_hi.resize((gw, gh), Image.Resampling.LANCZOS)
    p_grille = os.path.join(TEX_DIR, "corsair_5000d_grille.png")
    p_top_grille = os.path.join(TEX_DIR, "corsair_5000d_top_grille.png")
    grille_front.save(p_grille)
    grille_top.save(p_top_grille)

    # 1b. Fine-grain brushed anisotropic metallic roughness texture (gives VRM, chipset & RTX 5090 gunmetal realistic directional sheen!)
    rng_pr = random.Random(5000)
    pr_sz = 256
    pr_img = Image.new("L", (pr_sz, pr_sz), 118)
    pr_px = pr_img.load()
    for py in range(pr_sz):
        row_shift = int(rng_pr.gauss(0, 14))
        for px in range(pr_sz):
            pr_px[px, py] = max(72, min(168, 118 + row_shift + int(rng_pr.gauss(0, 5))))
    p_powder_rgh = os.path.join(TEX_DIR, "corsair_powder_rough.png")
    pr_img.save(p_powder_rgh)

    # 1c. Diffused Corsair iCUE LINK RX120 RGB Side Window Texture (soft cyan-teal diffuser behind dark trim, ZERO flat white bar!)
    rxw, rxh = 512, 96
    rx_img = Image.new("RGB", (rxw, rxh), (10, 13, 18))
    rxd = ImageDraw.Draw(rx_img)
    rxd.rectangle((10, 10, rxw - 11, rxh - 11), fill=(26, 72, 88), outline=(14, 18, 24), width=8)
    for x in range(22, rxw - 22):
        u = (x - 22) / max(1, (rxw - 44))
        glow = math.sin(u * math.pi) ** 0.55
        r_c = int(28 + 56 * glow)
        g_c = int(92 + 118 * glow)
        b_c = int(112 + 122 * glow)
        rxd.line((x, 18, x, rxh - 19), fill=(r_c, g_c, b_c), width=1)
    rxd.rectangle((18, 16, rxw - 19, rxh - 17), outline=(18, 24, 32), width=4)
    p_rx_side = os.path.join(TEX_DIR, "corsair_rx120_side.png")
    rx_img.save(p_rx_side)

    # 2. Crisp Perforated Matte-Black Corsair 5000D PSU Shroud Top (deep charcoal steel with sharp jet-black stamped triangular vents!)
    psw, psh = 1024, 2048
    psu_top = Image.new("RGB", (psw, psh), (26, 29, 35))
    psd = ImageDraw.Draw(psu_top)
    psd.rectangle((22, 22, psw - 22, psh - 22), outline=(8, 9, 12), width=6)
    psd.line((22, int(psh * 0.62), psw - 22, int(psh * 0.62)), fill=(7, 8, 10), width=5)
    for row in range(52):
        for col in range(24):
            x = 76 + col * 36 + (18 if row % 2 else 0)
            y = 92 + row * 32
            if 68 < x < psw - 68 and 86 < y < psh - 120:
                psd.polygon([(x, y - 8.0), (x + 9.2, y + 7.2), (x - 9.2, y + 7.2)], fill=(3, 4, 6))
    p_psu_top = os.path.join(TEX_DIR, "corsair_psu_top.png")
    psu_top.save(p_psu_top)

    # 3. Corrugated 360mm Aluminum Radiator Fin Core Texture
    rw, rh = 1024, 128
    rad_img = Image.new("RGB", (rw, rh), (16, 18, 22))
    rd = ImageDraw.Draw(rad_img)
    for x in range(8, rw - 8, 5):
        rd.line((x, 10, x, rh - 10), fill=(46, 50, 58), width=2)
    for y in (12, 40, 68, 96, 116):
        rd.line((0, y, rw, y), fill=(26, 29, 35), width=3)
    p_rad_fins = os.path.join(TEX_DIR, "corsair_rad_fins.png")
    rad_img.save(p_rad_fins)

    # 4. Deep Matte Woven-Nylon Braided Sleeve Texture for AIO Coolant Hoses (true matte carbon-black nylon weave, NEVER glossy grey plastic!)
    bw_s = 512
    braid_img = Image.new("RGB", (bw_s, bw_s), (9, 10, 13))
    bd = ImageDraw.Draw(braid_img)
    for k in range(-bw_s, bw_s * 2, 10):
        bd.line((k, 0, k + bw_s, bw_s), fill=(22, 25, 31), width=3)
        bd.line((k, bw_s, k + bw_s, 0), fill=(5, 6, 8), width=3)
    p_braid = os.path.join(TEX_DIR, "corsair_braided_sleeve.png")
    braid_img.save(p_braid)

    # 5. Subtle Real-World Corsair Sails Badge (front-bottom bezel ONLY — muted brushed silver on matte black!)
    cw, ch = 512, 128
    c_img = Image.new("RGB", (cw, ch), (18, 20, 25))
    cd = ImageDraw.Draw(c_img)
    cd.polygon([(110, 92), (124, 42), (133, 92)], fill=(138, 145, 158))
    cd.polygon([(133, 92), (150, 32), (160, 92)], fill=(138, 145, 158))
    cd.polygon([(159, 92), (172, 46), (181, 92)], fill=(138, 145, 158))
    cd.text((206, 40), "CORSAIR", fill=(148, 155, 168), font=f_md)
    p_corsair = os.path.join(TEX_DIR, "corsair_badge.png")
    c_img.save(p_corsair)

    # 6. Ultra-Crisp 2048x288 High-DPI NVIDIA GeForce RTX 5090 Founders Edition Side Branding
    sw, sh = 2048, 288
    g_side = Image.new("RGB", (sw, sh), (12, 14, 18))
    gsd = ImageDraw.Draw(g_side)
    for x in range(44, 196, 14):
        gsd.rectangle((x, 58, x + 6, sh - 58), fill=(4, 5, 7))
    for x in range(1830, 1996, 14):
        gsd.rectangle((x, 58, x + 6, sh - 58), fill=(4, 5, 7))
    try:
        f_gpu = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 76)
    except Exception:
        f_gpu = f_xl
    gsd.text((int(sw * 0.34), sh // 2), "GEFORCE RTX 5090", fill=(246, 250, 255), font=f_gpu, anchor="mm")
    p_gpu_side = os.path.join(TEX_DIR, "rtx5090_side.png")
    g_side.save(p_gpu_side)

    # 7. Seamless Dark-Gunmetal RTX 5090 FE Center Hourglass Backplate (ZERO rectangular decal seam, 100% unobstructed RTX 5090!)
    bw, bh = 2048, 1024
    g_top = Image.new("RGB", (bw, bh), (20, 22, 26))
    gtd = ImageDraw.Draw(g_top)
    try:
        f_top_rtx = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 128)
        f_top_5090 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 196)
        f_m2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
        f_io = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
    except Exception:
        f_top_rtx = f_top_5090 = f_m2 = f_io = f_xl
    # Subtle matching dark anodized hourglass seam lines framing the center text cleanly without any rectangular box!
    gtd.line((280, 110, 1768, 110), fill=(46, 50, 58), width=6)
    gtd.line((280, bh - 110, 1768, bh - 110), fill=(46, 50, 58), width=6)
    gtd.text((1024, 395), "RTX", fill=(168, 176, 190), font=f_top_rtx, anchor="mm")
    gtd.text((1024, 600), "5090", fill=(214, 222, 234), font=f_top_5090, anchor="mm")
    p_gpu_top = os.path.join(TEX_DIR, "rtx5090_top.png")
    g_top.save(p_gpu_top)

    # 7b. Exact ORIGIN PC #694619 Component Textures:
    #     - Corsair MP700 PRO 4TB PCIe Gen5 M.2 Heatsink
    #     - Corsair MP600 CORE XT R2 1TB OS M.2 NVMe Drive (bare stick with teal-accented Corsair label)
    #     - MSI PRO Z890-P WIFI Brushed-Silver Rear I/O Armor
    #     - Corsair VENGEANCE DDR5 96GB (2x48GB) Non-RGB Heatspreader Side Plate
    #     - Corsair HX1500i Platinum PSU Side Label (visible through PSU shroud cutout window!)
    mp7_img = Image.new("RGB", (1024, 192), (24, 27, 33))
    mp7d = ImageDraw.Draw(mp7_img)
    for y in range(0, 192, 6):
        c = 22 + (y % 12)
        mp7d.line((0, y, 1024, y), fill=(c, c + 3, c + 7), width=3)
    mp7d.rectangle((14, 14, 1010, 178), outline=(72, 78, 88), width=5)
    mp7d.line((40, 138, 984, 138), fill=(168, 176, 190), width=4)
    mp7d.text((512, 82), "CORSAIR  MP700 PRO  4TB  GEN5", fill=(234, 240, 250), font=f_m2, anchor="mm")
    p_mp700 = os.path.join(TEX_DIR, "corsair_mp700_pro.png")
    mp7_img.save(p_mp700)

    mp6_img = Image.new("RGB", (1024, 192), (24, 26, 31))
    mp6d = ImageDraw.Draw(mp6_img)
    # Authentic Corsair matte-black + Corsair-yellow corner accent stripe M.2 NVMe sticker (ZERO glowing cyan!)
    mp6d.rectangle((0, 0, 118, 192), fill=(198, 156, 36))
    mp6d.polygon([(118, 0), (156, 0), (118, 192)], fill=(198, 156, 36))
    mp6d.rectangle((14, 14, 1010, 178), outline=(74, 78, 88), width=4)
    mp6d.text((575, 72), "CORSAIR  MP600 CORE XT", fill=(236, 240, 248), font=f_m2, anchor="mm")
    mp6d.text((575, 134), "R2  ·  1TB  PCIe Gen4 x4 NVMe M.2", fill=(168, 176, 190), font=f_sm, anchor="mm")
    p_mp600 = os.path.join(TEX_DIR, "corsair_mp600_core_xt.png")
    mp6_img.save(p_mp600)

    io_img = Image.new("RGB", (512, 1024), (192, 198, 208))
    iod = ImageDraw.Draw(io_img)
    for y in range(0, 1024, 4):
        c = 186 + (y % 8)
        iod.line((0, y, 512, y), fill=(c, c + 4, c + 9), width=2)
    for k in range(8):
        iod.line((28, 110 + k * 28, 484, 60 + k * 28), fill=(88, 94, 106), width=8)
    iod.rectangle((18, 456, 446, 610), fill=(36, 40, 48), outline=(218, 224, 236), width=5)
    try:
        f_io_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
    except Exception:
        f_io_sm = f_io
    iod.text((224, 510), "PRO Z890-P", fill=(246, 250, 255), font=f_io_sm, anchor="mm")
    iod.text((224, 568), "MSI · WIFI", fill=(182, 212, 242), font=f_md, anchor="mm")
    p_io_tex = os.path.join(TEX_DIR, "mobo_rear_io.png")
    io_img.save(p_io_tex)

    ram_img = Image.new("RGB", (256, 1024), (20, 22, 27))
    ramd = ImageDraw.Draw(ram_img)
    for y in range(60, 960, 28):
        ramd.polygon([(36, y), (74, y - 16), (74, y + 16)], fill=(34, 38, 46))
        ramd.polygon([(220, y), (182, y - 16), (182, y + 16)], fill=(34, 38, 46))
    ramd.line((128, 120, 128, 904), fill=(96, 104, 118), width=5)
    ramd.rectangle((62, 340, 194, 684), fill=(26, 29, 36), outline=(112, 120, 134), width=4)
    try:
        f_ram = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
    except Exception:
        f_ram = f_md
    # Vertical VENGEANCE DDR5 lettering rendered via rotated strip
    v_strip = Image.new("RGB", (320, 80), (26, 29, 36))
    vsd = ImageDraw.Draw(v_strip)
    vsd.text((160, 40), "VENGEANCE DDR5", fill=(214, 222, 236), font=f_ram, anchor="mm")
    ram_img.paste(v_strip.rotate(90, expand=True), (88, 352))
    p_ram_tex = os.path.join(TEX_DIR, "corsair_vengeance_ddr5.png")
    ram_img.save(p_ram_tex)

    # Corsair HX1500i Platinum Industrial PSU Side Label (100% centered & unclipped inside PSU shroud cutout window!)
    hxw, hxh = 1024, 384
    hx_img = Image.new("RGB", (hxw, hxh), (14, 16, 20))
    hxd = ImageDraw.Draw(hx_img)
    hxd.rectangle((16, 16, hxw - 17, hxh - 17), outline=(58, 64, 74), width=6)
    hxd.polygon([(20, 20), (142, 20), (92, hxh - 20), (20, hxh - 20)], fill=(32, 36, 44))
    hxd.polygon([(150, 20), (174, 20), (124, hxh - 20), (100, hxh - 20)], fill=(116, 124, 138))
    try:
        f_hx_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 104)
        f_hx_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
    except Exception:
        f_hx_big, f_hx_sub = f_xl, f_md
    hxd.text((555, 148), "HX1500i", fill=(230, 238, 248), font=f_hx_big, anchor="mm")
    hxd.text((555, 258), "CORSAIR · 80 PLUS PLATINUM · 1500W", fill=(156, 168, 186), font=f_hx_sub, anchor="mm")
    p_hx1500i = os.path.join(TEX_DIR, "corsair_hx1500i_side.png")
    hx_img.save(p_hx1500i)

    # 8. Ultra-Detailed 2048x2560 Photorealistic ATX PRO Z890-A WIFI Motherboard PCB Texture!
    mw, mh = 2048, 2560
    rng = random.Random(890)
    mb = Image.new("RGB", (mw, mh), (18, 21, 27))
    md = ImageDraw.Draw(mb)
    # Subtle matte dark-charcoal PCB fiberglass grid + diagonal copper-tinted bus routing!
    for y in range(60, mh - 60, 24):
        md.line((40, y, mw - 40, y), fill=(32, 38, 48), width=3)
    for x in range(60, mw - 60, 32):
        md.line((x, 40, x, mh - 40), fill=(28, 34, 44), width=2)
    # Multi-lane high-speed DDR5 / PCIe 5.0 serpentine routing traces (subtle metallic copper-grey)
    for k in range(28):
        md.line((280 + k * 24, 1220, 560 + k * 24, 1540), fill=(68, 76, 92), width=4)
        md.line((760 + k * 22, 680, 1080 + k * 22, 980), fill=(62, 72, 88), width=3)
        md.line((220 + k * 18, 1780, 480 + k * 18, 2060), fill=(58, 66, 82), width=3)
    # Realistic clusters of tiny silver SMD resistors, MLCC capacitors & black ICs across PCB!
    for _ in range(420):
        sx = rng.randint(120, mw - 120)
        sy = rng.randint(140, mh - 140)
        if rng.random() < 0.72:
            md.rectangle((sx, sy, sx + 10, sy + 6), fill=(154, 162, 176), outline=(58, 64, 74))
        else:
            md.rectangle((sx, sy, sx + 28, sy + 28), fill=(12, 14, 18), outline=(124, 132, 148), width=2)
    # 9 ATX brass/silver mounting standoff rings with solder pads
    for sx in (110, 1024, 1930):
        for sy in (110, 1280, 2440):
            md.ellipse((sx - 28, sy - 28, sx + 28, sy + 28), fill=(170, 178, 190), outline=(92, 98, 110), width=4)
            md.ellipse((sx - 12, sy - 12, sx + 12, sy + 12), fill=(24, 28, 34))
    # High-contrast white PCB silkscreen markings & diagnostic block
    md.rectangle((160, 1700, 1240, 1712), fill=(88, 98, 116))
    md.text((180, 1650), "PCI_E1  GEN5 x16  STEEL ARMOR", fill=(186, 198, 218), font=f_sm)
    md.text((180, 2140), "MSI PRO Z890-P WIFI  ·  LIGHTNING GEN5 M.2  ·  DDR5 BOOST", fill=(196, 208, 228), font=f_md)
    md.text((180, 2240), "AUDIO BOOST  ·  5G LAN  ·  WI-FI 7  ·  CORE ULTRA 9 285K", fill=(148, 162, 184), font=f_sm)
    # Gold audio filter caps silkscreen ring
    for k in range(7):
        ay = 1840 + k * 68
        md.ellipse((110, ay, 164, ay + 54), fill=(216, 172, 68), outline=(60, 46, 22), width=4)
    p_mobo = os.path.join(TEX_DIR, "atx_mobo_pcb.png")
    mb.save(p_mobo)

    # 9. Corsair iCUE LINK TITAN 360 RX RGB Sculpted Smoked CapSwap Dome Face (diffused cyan-teal geometric halo — ZERO flat white sticker!)
    lw, lh = 512, 512
    lcd = Image.new("RGB", (lw, lh), (10, 13, 18))
    ld = ImageDraw.Draw(lcd)
    # Soft multi-ring diffused cyan-teal RGB glow beneath smoked CapSwap acrylic
    for r_ring, col_ring in [
        (244, (16, 44, 58)),
        (234, (36, 118, 142)),
        (224, (74, 182, 206)),
        (212, (42, 128, 152)),
        (198, (18, 42, 56)),
        (184, (12, 15, 22)),
    ]:
        ld.ellipse((256 - r_ring, 256 - r_ring, 256 + r_ring, 256 + r_ring), fill=col_ring)
    # Subtle sculpted geometric CapSwap faceted lines across the smoked center dome
    for ang_deg in range(0, 360, 45):
        a = math.radians(ang_deg)
        ld.line((256 + math.cos(a) * 96, 256 + math.sin(a) * 96, 256 + math.cos(a) * 190, 256 + math.sin(a) * 190), fill=(28, 40, 54), width=5)
    ld.ellipse((78, 78, lw - 78, lh - 78), outline=(36, 52, 68), width=4)
    # Understated backlit cyan-silver Corsair sails emblem recessed cleanly inside smoked CapSwap dome
    ld.polygon([(194, 308), (216, 210), (234, 308)], fill=(128, 198, 220))
    ld.polygon([(232, 308), (260, 178), (284, 308)], fill=(168, 226, 244))
    ld.polygon([(280, 308), (304, 218), (322, 308)], fill=(128, 198, 220))
    try:
        f_titan = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except Exception:
        f_titan = f_sm
    ld.text((256, 356), "TITAN RX", fill=(102, 178, 204), font=f_titan, anchor="mm")
    p_lcd = os.path.join(TEX_DIR, "corsair_titan_cap.png")
    lcd.save(p_lcd)

    # 1d. Radial Hub-to-Tip Translucent Frosted Corsair RX120 RGB Blade Color & Emission Textures (u=0 hub -> u=1 tip!)
    bw_r, bh_r = 256, 128
    blade_col = Image.new("RGB", (bw_r, bh_r), (28, 36, 44))
    blade_em = Image.new("RGB", (bw_r, bh_r), (0, 0, 0))
    bcd = ImageDraw.Draw(blade_col)
    bed = ImageDraw.Draw(blade_em)
    for x in range(bw_r):
        u = x / max(1, bw_r - 1)  # 0.0 = hub root, 1.0 = outer blade tip
        hub_falloff = max(0.0, 1.0 - u / 0.72) ** 1.65
        # Frosted translucent smoked polycarbonate: bright cyan-ice near hub -> smoky charcoal-slate tips!
        rc = int(26 + 68 * hub_falloff)
        gc = int(34 + 148 * hub_falloff)
        bc = int(44 + 178 * hub_falloff)
        bcd.line((x, 0, x, bh_r - 1), fill=(rc, gc, bc))
        # Emissive glow concentrated strictly near the 8-LED RGB hub (decays cleanly to 0 at blade tips!)
        em_k = max(0.0, 1.0 - u / 0.56) ** 2.0
        bed.line((x, 0, x, bh_r - 1), fill=(int(54 * em_k), int(186 * em_k), int(226 * em_k)))
    # Subtle leading/trailing rim edge highlights on frosted polycarbonate blade
    bcd.rectangle((0, 0, bw_r - 1, 5), fill=(86, 118, 134))
    bcd.rectangle((0, bh_r - 6, bw_r - 1, bh_r - 1), fill=(44, 58, 70))
    p_rx_blade_col = os.path.join(TEX_DIR, "corsair_rx120_blade_col.png")
    p_rx_blade_em = os.path.join(TEX_DIR, "corsair_rx120_blade_em.png")
    blade_col.save(p_rx_blade_col)
    blade_em.save(p_rx_blade_em)

    return p_grille, p_top_grille, p_powder_rgh, p_rx_side, p_rx_blade_col, p_rx_blade_em, p_psu_top, p_rad_fins, p_braid, p_corsair, p_gpu_side, p_gpu_top, p_mp700, p_mp600, p_io_tex, p_ram_tex, p_hx1500i, p_mobo, p_lcd


def make_mat(name, color, metallic=0.75, roughness=0.38, emit=None, emit_strength=0.0, alpha=1.0, rough_tex=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    if rough_tex is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(rough_tex)
        img.colorspace_settings.name = "Non-Color"
        img.pack()
        tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Roughness"].default_value = roughness
    if emit is not None:
        bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def make_tex_mat(name, path, metallic=0.45, roughness=0.35, emit_strength=0.0, use_alpha=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(path)
    img.pack()
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if emit_strength > 0:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission"])
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if use_alpha:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        mat.blend_method = "CLIP"
    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=2, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def add_cyl(name, r, depth, loc, rot, mat, verts=28):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_torus(name, major_r, minor_r, loc, rot, mat):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r, minor_radius=minor_r, major_segments=64, minor_segments=16, location=loc, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_bezier_tube(name, p0, p1, p2, p3, radius, mat, steps=28):
    """Build a smooth, exact cubic-Bezier 3D tube so cable combs & fittings align mathematically at any parameter t!"""
    pts = [eval_cubic_bezier(p0, p1, p2, p3, i / steps) for i in range(steps + 1)]
    cd = bpy.data.curves.new(name, type="CURVE")
    cd.dimensions = "3D"
    cd.resolution_u = 2
    cd.bevel_depth = radius
    cd.bevel_resolution = 10
    sp = cd.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    obj = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    for p in bpy.context.active_object.data.polygons:
        p.use_smooth = True
    return bpy.context.active_object


def add_curved_fan_blades(name, loc, axis, mat, count=9):
    """Build high-poly silky-smooth swept aerodynamic airfoil impeller blades in bmesh with radial hub-to-tip UVs."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for b in range(count):
        base_a = (b / count) * math.pi * 2.0
        rings = []
        r_steps = [18 * MM, 22 * MM, 26.5 * MM, 31 * MM, 36 * MM, 40.5 * MM, 45 * MM, 49 * MM]
        chord_steps = [11.5 * MM, 15.5 * MM, 19.0 * MM, 21.5 * MM, 22.5 * MM, 21.5 * MM, 19.0 * MM, 14.5 * MM]
        twist_steps = [0.64, 0.58, 0.52, 0.46, 0.41, 0.36, 0.31, 0.27]
        sweep_steps = [0.0, 0.05, 0.11, 0.19, 0.28, 0.37, 0.46, 0.56]
        for r, chord, twist, sw in zip(r_steps, chord_steps, twist_steps, sweep_steps):
            a = base_a + sw
            ca, sa = math.cos(a), math.sin(a)
            tx, ty = -sa, ca
            ring_v = []
            for s in (-0.5, -0.25, 0.0, 0.25, 0.5):
                camber = (1.0 - (s * 2.0) ** 2) * 2.0 * MM
                d_tan = s * chord * math.cos(twist)
                d_ax = s * chord * math.sin(twist) + camber
                if axis == "Y":
                    vx = loc[0] + ca * r + tx * d_tan
                    vy = loc[1] + d_ax
                    vz = loc[2] + sa * r + ty * d_tan
                else:
                    vx = loc[0] + ca * r + tx * d_tan
                    vy = loc[1] + sa * r + ty * d_tan
                    vz = loc[2] + d_ax
                ring_v.append(bm.verts.new((vx, vy, vz)))
            rings.append(ring_v)
        n_r = len(rings) - 1
        for ir in range(n_r):
            u0 = ir / n_r
            u1 = (ir + 1) / n_r
            for ic in range(4):
                v0 = ic / 4.0
                v1 = (ic + 1) / 4.0
                f = bm.faces.new((rings[ir][ic], rings[ir][ic + 1], rings[ir + 1][ic + 1], rings[ir + 1][ic]))
                f.smooth = True
                for loop, uv in zip(f.loops, [(u0, v0), (u0, v1), (u1, v1), (u1, v0)]):
                    loop[uv_layer].uv = uv
    me = bpy.data.meshes.new(name + "_M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    sol = obj.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 1.5 * MM
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sol.name)
    return obj


def build_corsair_rtx5090():
    clear_scene()
    p_grille, p_top_grille, p_powder_rgh, p_rx_side, p_rx_blade_col, p_rx_blade_em, p_psu_top, p_rad_fins, p_braid, p_corsair, p_gpu_side, p_gpu_top, p_mp700, p_mp600, p_io_tex, p_ram_tex, p_hx1500i, p_mobo, p_lcd = generate_textures()

    # Photorealistic PBR materials: subtle micro-roughness powder-coated 5000D steel + anisotropic brushed titanium/aluminum!
    steel_matte = make_mat("Corsair_MatteSteel", (0.044, 0.049, 0.058), metallic=0.46, roughness=0.52, rough_tex=p_powder_rgh)
    steel_dark = make_mat("Corsair_DarkInterior", (0.014, 0.017, 0.022), metallic=0.30, roughness=0.74)
    psu_powder = make_mat("Corsair_MattePowderCoat", (0.017, 0.020, 0.025), metallic=0.14, roughness=0.86)
    cable_bar_black = make_mat("Corsair_RapidRouteMatte", (0.012, 0.014, 0.018), metallic=0.10, roughness=0.84)
    rubber_grommet = make_mat("Corsair_RubberGrommet", (0.010, 0.012, 0.015), metallic=0.0, roughness=0.94)
    # Real NVIDIA GeForce RTX 5090 FE dark satin gunmetal/titanium anodized aluminum with brushed micro-roughness!
    titanium = make_mat("FE_TitaniumGunmetal", (0.058, 0.064, 0.074), metallic=0.76, roughness=0.44, rough_tex=p_powder_rgh)
    fe_xframe = make_mat("FE_XFrameGunmetal", (0.078, 0.084, 0.096), metallic=0.78, roughness=0.40, rough_tex=p_powder_rgh)
    fe_trim = make_mat("FE_SilverTrim", (0.62, 0.66, 0.72), metallic=0.92, roughness=0.24)
    fe_fin = make_mat("FE_FinStack", (0.004, 0.005, 0.007), metallic=0.55, roughness=0.52)
    fe_fin_blade = make_mat("FE_FinBlade", (0.018, 0.021, 0.026), metallic=0.72, roughness=0.36)
    vrm_metal = make_mat("Mobo_VRM", (0.58, 0.62, 0.68), metallic=0.88, roughness=0.28, rough_tex=p_powder_rgh)
    vrm_dark = make_mat("Mobo_VRMDark", (0.036, 0.041, 0.049), metallic=0.68, roughness=0.44)
    cap_gold = make_mat("Mobo_GoldCap", (0.78, 0.58, 0.22), metallic=0.90, roughness=0.24)
    # Authentic Corsair Premium Individually-Sleeved Type-4 Gen 4 MATTE-BLACK paracord cables (subtle woven fabric sheen, NEVER light grey!)
    braid_mat = make_mat("Braided_Cable", (0.010, 0.011, 0.014), metallic=0.02, roughness=0.88)
    braid_accent = make_mat("Braided_CableGraphite", (0.018, 0.021, 0.026), metallic=0.04, roughness=0.84)
    hose_mat = make_tex_mat("AIO_BraidedHose", p_braid, metallic=0.0, roughness=0.96)
    ram_spreader = make_mat("Vengeance_Heatsink", (0.058, 0.064, 0.076), metallic=0.82, roughness=0.28)
    fan_frame_mat = make_mat("Corsair_FanFrame", (0.022, 0.026, 0.032), metallic=0.24, roughness=0.48)
    # Authentic Corsair iCUE LINK RX120 RGB translucent frosted blades with REAL radial hub-to-tip LED falloff!
    fan_blade_mat = bpy.data.materials.new("Corsair_RX120Blade")
    fan_blade_mat.use_nodes = True
    fnt = fan_blade_mat.node_tree
    fbsdf = fnt.nodes["Principled BSDF"]
    fbsdf.inputs["Metallic"].default_value = 0.06
    fbsdf.inputs["Roughness"].default_value = 0.26
    fbsdf.inputs["Alpha"].default_value = 0.86
    fan_blade_mat.blend_method = "BLEND"
    ftex_c = fnt.nodes.new("ShaderNodeTexImage")
    fimg_c = bpy.data.images.load(p_rx_blade_col)
    fimg_c.pack()
    ftex_c.image = fimg_c
    fnt.links.new(ftex_c.outputs["Color"], fbsdf.inputs["Base Color"])
    ftex_e = fnt.nodes.new("ShaderNodeTexImage")
    fimg_e = bpy.data.images.load(p_rx_blade_em)
    fimg_e.pack()
    ftex_e.image = fimg_e
    fnt.links.new(ftex_e.outputs["Color"], fbsdf.inputs["Emission"])
    fbsdf.inputs["Emission Strength"].default_value = 1.05
    corsair_yellow = make_mat("Corsair_YellowAccent", (0.72, 0.54, 0.06), metallic=0.0, roughness=0.68)

    rgb_cyan = make_mat("RGB_Cyan", (0.38, 0.78, 0.96), 0.0, 0.24, (0.34, 0.76, 0.96), 1.48)
    rgb_mint = make_mat("RGB_Mint", (0.34, 0.84, 0.78), 0.0, 0.24, (0.30, 0.82, 0.76), 1.40)
    rx_side_mat = make_tex_mat("Corsair_RX120SideWindow", p_rx_side, metallic=0.08, roughness=0.26, emit_strength=0.92)
    fe_white_led = make_mat("FE_WhiteLED", (0.74, 0.78, 0.84), 0.0, 0.30, (0.70, 0.76, 0.84), 0.28)
    cap_dome_mat = make_mat("Corsair_TitanDomeGlass", (0.04, 0.06, 0.08), metallic=0.14, roughness=0.16, alpha=0.42)

    grille_mat = make_tex_mat("Corsair_AirflowGrille", p_grille, metallic=0.60, roughness=0.42, use_alpha=True)
    top_grille_mat = make_tex_mat("Corsair_TopAirflowGrille", p_top_grille, metallic=0.56, roughness=0.44, use_alpha=True)
    psu_top_mat = make_tex_mat("Corsair_PSUTopVent", p_psu_top, metallic=0.10, roughness=0.88)
    rad_fin_mat = make_tex_mat("Corsair_RadFinCore", p_rad_fins, metallic=0.62, roughness=0.42)
    badge_mat = make_tex_mat("Corsair_Badge", p_corsair, metallic=0.50, roughness=0.38)
    mobo_mat = make_tex_mat("Mobo_PCB", p_mobo, metallic=0.24, roughness=0.44)
    mp700_mat = make_tex_mat("Corsair_MP700Pro", p_mp700, metallic=0.58, roughness=0.34, emit_strength=0.10)
    mp600_mat = make_tex_mat("Corsair_MP600CoreXT", p_mp600, metallic=0.14, roughness=0.46, emit_strength=0.08)
    rear_io_mat = make_tex_mat("Mobo_RearIOTex", p_io_tex, metallic=0.82, roughness=0.28)
    ram_side_mat = make_tex_mat("Corsair_VengeanceSide", p_ram_tex, metallic=0.62, roughness=0.34, emit_strength=0.08)
    hx1500i_mat = make_tex_mat("Corsair_HX1500iSide", p_hx1500i, metallic=0.32, roughness=0.42, emit_strength=0.12)
    gpu_side_mat = make_tex_mat("RTX5090_SideLabel", p_gpu_side, metallic=0.68, roughness=0.44, emit_strength=1.12)
    gpu_top_mat = make_tex_mat("RTX5090_TopPlate", p_gpu_top, metallic=0.70, roughness=0.46, emit_strength=0.04)
    lcd_mat = make_tex_mat("Corsair_TitanCap", p_lcd, metallic=0.24, roughness=0.22, emit_strength=0.78)
    glass_mat = make_mat("Corsair_TemperedGlass", (0.04, 0.055, 0.075), metallic=0.10, roughness=0.07, alpha=0.20)
    glass_rim_mat = make_mat("Corsair_GlassRim", (0.09, 0.12, 0.15), metallic=0.20, roughness=0.12)

    z0 = FOOT_H
    W, D, H = CASE_W, CASE_D, CASE_H

    # 1. Sculpted Angled Corsair 5000D Feet (~26mm open desk clearance + angled outer bevels + rubber pads!)
    for fx in (-W * 0.5 + 30 * MM, W * 0.5 - 30 * MM):
        for fy in (-D * 0.5 + 58 * MM, D * 0.5 - 58 * MM):
            add_box(f"Foot_{fx:.2f}_{fy:.2f}", (36 * MM, 74 * MM, FOOT_H), (fx, fy, FOOT_H * 0.5), steel_matte, bevel=5.5 * MM, segments=3)
            add_box(f"FootTrim_{fx:.2f}_{fy:.2f}", (38 * MM, 76 * MM, 4.0 * MM), (fx, fy, FOOT_H - 2.0 * MM), steel_dark, bevel=1.0 * MM)
            add_box(f"FootPad_{fx:.2f}_{fy:.2f}", (30 * MM, 64 * MM, 3.5 * MM), (fx, fy, 1.75 * MM), rubber_grommet)

    # 2. Micro-Beveled Corsair 5000D Airflow Outer Frame (front = -Y, rear = +Y, glass left = -X, solid right = +X)
    add_box("Case_Bottom", (W, D, 16 * MM), (0, 0, z0 + 8 * MM), steel_matte, bevel=3.5 * MM, segments=3)
    add_box("Case_TopLeft", (26 * MM, D, 18 * MM), (-W * 0.5 + 13 * MM, 0, z0 + H - 9 * MM), steel_matte, bevel=3.5 * MM, segments=3)
    add_box("Case_TopRight", (26 * MM, D, 18 * MM), (W * 0.5 - 13 * MM, 0, z0 + H - 9 * MM), steel_matte, bevel=3.5 * MM, segments=3)
    add_box("Case_TopFrontIO", (W, 76 * MM, 18 * MM), (0, -D * 0.5 + 38 * MM, z0 + H - 9 * MM), steel_matte, bevel=3.5 * MM, segments=3)
    add_box("Case_TopRear", (W, 42 * MM, 18 * MM), (0, D * 0.5 - 21 * MM, z0 + H - 9 * MM), steel_matte, bevel=3.5 * MM, segments=3)

    # Top-Front Recessed 5000D I/O Panel with Clearly Visible Corsair Yellow USB-A Ports + USB-C + Power Button!
    io_z = z0 + H + 0.6 * MM
    io_y = -D * 0.5 + 32 * MM
    add_box("TopIO_RecessPlate", (166 * MM, 22 * MM, 1.8 * MM), (0, io_y, io_z - 0.3 * MM), steel_dark, bevel=0.5 * MM)
    add_box("TopIO_PowerBezel", (26 * MM, 11 * MM, 2.2 * MM), (-62 * MM, io_y, io_z), steel_matte, bevel=0.4 * MM)
    add_box("TopIO_PowerLED", (18 * MM, 3.6 * MM, 2.6 * MM), (-62 * MM, io_y, io_z + 0.4 * MM), rgb_cyan)
    for ux in (-26 * MM, 2 * MM):
        add_box(f"TopIO_USBA_Socket_{ux:.2f}", (16 * MM, 7.6 * MM, 2.2 * MM), (ux, io_y, io_z), rubber_grommet)
        add_box(f"TopIO_USBA_Tongue_{ux:.2f}", (12 * MM, 3.2 * MM, 2.8 * MM), (ux, io_y - 0.8 * MM, io_z + 0.5 * MM), corsair_yellow)
    add_box("TopIO_USBC", (11 * MM, 4.8 * MM, 2.2 * MM), (28 * MM, io_y, io_z), fe_trim)
    add_cyl("TopIO_Audio", 3.6 * MM, 2.4 * MM, (48 * MM, io_y, io_z), (0, 0, 0), rubber_grommet, 14)
    add_box("TopIO_Reset", (9 * MM, 6.2 * MM, 2.2 * MM), (66 * MM, io_y, io_z), steel_matte)

    # Recessed Removable Top Magnetic Airflow Steel Panel with TRUE Alpha-Cutout Triangular Perforations & Radiator Depth Underneath!
    # Perimeter recess lip (4 thin rails leaving the center genuinely open down to the 360mm radiator & sub-filter!)
    add_box("Case_TopRecessL", (8 * MM, D - 110 * MM, 6 * MM), (-W * 0.5 + 26 * MM, 18 * MM, z0 + H - 4.0 * MM), rubber_grommet)
    add_box("Case_TopRecessR", (8 * MM, D - 110 * MM, 6 * MM), (W * 0.5 - 26 * MM, 18 * MM, z0 + H - 4.0 * MM), rubber_grommet)
    add_box("Case_TopRecessF", (W - 44 * MM, 8 * MM, 6 * MM), (0, -D * 0.5 + 75 * MM, z0 + H - 4.0 * MM), rubber_grommet)
    add_box("Case_TopRecessBk", (W - 44 * MM, 8 * MM, 6 * MM), (0, D * 0.5 - 39 * MM, z0 + H - 4.0 * MM), rubber_grommet)
    # Recessed dark sub-cavity floor 12mm below top mesh so every stamped triangle shows deep dark physical depth!
    add_box("Case_TopRadShadowBack", (W - 60 * MM, D - 126 * MM, 2.0 * MM), (0, 18 * MM, z0 + H - 14.0 * MM), fe_fin)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 18 * MM, z0 + H - 0.6 * MM))
    top_mesh = bpy.context.active_object
    top_mesh.name = "Case_TopAirflowMesh"
    top_mesh.scale = (W - 50 * MM, D - 116 * MM, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    top_mesh.data.materials.append(top_grille_mat)

    # Right panel, Rear panel, Motherboard tray, Perforated Rear Exhaust Grille & Detailed Rear PCIe Expansion Brackets!
    add_box("Case_RightPanel", (14 * MM, D, H), (W * 0.5 - 7 * MM, 0, z0 + H * 0.5), steel_matte, bevel=3.0 * MM)
    add_box("Case_RearPanel", (W, 14 * MM, H), (0, D * 0.5 - 7 * MM, z0 + H * 0.5), steel_matte, bevel=3.0 * MM)
    add_box("Case_MoboTray", (4 * MM, D - 40 * MM, H - 36 * MM), (W * 0.5 - 32 * MM, 0, z0 + H * 0.5), steel_dark)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, D * 0.5 - 15.6 * MM, z0 + 372 * MM))
    r_grille = bpy.context.active_object
    r_grille.name = "Rear_ExhaustGrille"
    r_grille.scale = (118 * MM, 118 * MM, 1.0)
    r_grille.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    r_grille.data.materials.append(top_grille_mat)

    for s in range(7):
        sz = z0 + 136 * MM + s * 19.5 * MM
        add_box(f"Rear_PCIeSlot_{s}", (108 * MM, 5 * MM, 13 * MM), (-18 * MM, D * 0.5 - 15.5 * MM, sz), steel_matte, bevel=0.8 * MM)
        add_box(f"Rear_PCIeVent_{s}", (80 * MM, 6 * MM, 5.5 * MM), (-18 * MM, D * 0.5 - 16.0 * MM, sz), rubber_grommet)
        add_cyl(f"Rear_PCIeScrew_{s}", 2.2 * MM, 4 * MM, (-68 * MM, D * 0.5 - 18.0 * MM, sz), (math.pi / 2, 0, 0), fe_trim, 12)

    # Flush Left (-X) Tempered Glass Perimeter Frame + Front/Rear Steel Pillars
    add_box("Case_GlassTopRail", (12 * MM, D, 18 * MM), (-W * 0.5 + 6 * MM, 0, z0 + H - 9 * MM), steel_matte, bevel=2.5 * MM)
    add_box("Case_GlassBotRail", (12 * MM, D, 18 * MM), (-W * 0.5 + 6 * MM, 0, z0 + 9 * MM), steel_matte, bevel=2.5 * MM)
    add_box("Case_GlassFrontRail", (12 * MM, 18 * MM, H), (-W * 0.5 + 6 * MM, -D * 0.5 + 9 * MM, z0 + H * 0.5), steel_matte, bevel=2.5 * MM)
    add_box("Case_GlassRearRail", (12 * MM, 18 * MM, H), (-W * 0.5 + 6 * MM, D * 0.5 - 9 * MM, z0 + H * 0.5), steel_matte, bevel=2.5 * MM)

    # Front (-Y) Removable Stamped Steel Airflow Panel with Shadow Seam + Crisp Alpha-Cutout Triangular Mesh + Yellow Tab
    add_box("Front_LeftPost", (22 * MM, 26 * MM, H), (-W * 0.5 + 11 * MM, -D * 0.5 + 13 * MM, z0 + H * 0.5), steel_matte, bevel=3.5 * MM)
    add_box("Front_RightPost", (22 * MM, 26 * MM, H), (W * 0.5 - 11 * MM, -D * 0.5 + 13 * MM, z0 + H * 0.5), steel_matte, bevel=3.5 * MM)
    add_box("Front_TopBezel", (W, 26 * MM, 36 * MM), (0, -D * 0.5 + 13 * MM, z0 + H - 18 * MM), steel_matte, bevel=3.5 * MM)
    add_box("Front_BotBezel", (W, 26 * MM, 54 * MM), (0, -D * 0.5 + 13 * MM, z0 + 27 * MM), steel_matte, bevel=3.5 * MM)
    add_box("Front_PanelSeamL", (3 * MM, 28 * MM, H - 90 * MM), (-W * 0.5 + 21 * MM, -D * 0.5 + 12 * MM, z0 + H * 0.5 + 10 * MM), rubber_grommet)
    # Molded matte vulcanized-silicone Corsair yellow accent pull-tab tucked cleanly into bezel corner
    add_box("Front_YellowTabBase", (5 * MM, 11 * MM, 16 * MM), (-W * 0.5 + 2.5 * MM, -D * 0.5 + 18 * MM, z0 + 78 * MM), rubber_grommet, bevel=0.8 * MM)
    add_box("Front_YellowTab", (3.5 * MM, 8.5 * MM, 12.5 * MM), (-W * 0.5 + 1.2 * MM, -D * 0.5 + 18 * MM, z0 + 78 * MM), corsair_yellow, bevel=1.0 * MM, segments=3)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -D * 0.5 + 3.0 * MM, z0 + H * 0.5 + 10 * MM))
    f_grille = bpy.context.active_object
    f_grille.name = "Front_AirflowMesh"
    f_grille.scale = (W - 42 * MM, H - 88 * MM, 1.0)
    f_grille.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    f_grille.data.materials.append(grille_mat)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -D * 0.5 - 0.5 * MM, z0 + 27 * MM))
    f_badge = bpy.context.active_object
    f_badge.name = "Front_CorsairBadge"
    f_badge.scale = (74 * MM, 18.5 * MM, 1.0)
    f_badge.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    f_badge.data.materials.append(badge_mat)

    # 3. Full-Height Matte Powder-Coated Ventilated PSU Shroud with Cutout Window Showcasing the Corsair HX1500i Platinum PSU!
    shroud_h = 122 * MM
    shroud_top_z = z0 + 16 * MM + shroud_h
    shroud_z_mid = z0 + 16 * MM + shroud_h * 0.5
    # Build PSU shroud with a genuine recessed viewing cutout window on the rear-left side so the Corsair HX1500i Platinum PSU is visibly showcased!
    add_box("PSU_ShroudFront", (W - 30 * MM, 260 * MM, shroud_h), (4 * MM, -106 * MM, shroud_z_mid), psu_powder, bevel=2.5 * MM)
    add_box("PSU_ShroudRearTop", (W - 30 * MM, 224 * MM, 22 * MM), (4 * MM, 136 * MM, shroud_top_z - 11 * MM), psu_powder, bevel=1.8 * MM)
    add_box("PSU_ShroudRearBot", (W - 30 * MM, 224 * MM, 22 * MM), (4 * MM, 136 * MM, z0 + 27 * MM), psu_powder, bevel=1.8 * MM)
    add_box("PSU_ShroudRearRight", (W - 60 * MM, 224 * MM, shroud_h), (20 * MM, 136 * MM, shroud_z_mid), psu_powder)
    add_box("PSU_ShroudRearPost", (30 * MM, 28 * MM, shroud_h), (-W * 0.5 + 29 * MM, 234 * MM, shroud_z_mid), psu_powder, bevel=1.5 * MM)

    # Actual Corsair HX1500i Platinum 1500W PSU (200 x 150 x 86 mm) seated cleanly inside the PSU shroud window cutout (100% centered & unclipped!)
    add_box("PSU_HX1500i_Body", (150 * MM, 200 * MM, 86 * MM), (-16 * MM, 134 * MM, z0 + 62 * MM), steel_dark, bevel=2.5 * MM)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(-91.6 * MM, 134 * MM, z0 + 62 * MM))
    hx_pl = bpy.context.active_object
    hx_pl.name = "PSU_HX1500i_SideBadge"
    hx_pl.scale = (164 * MM, 62 * MM, 1.0)
    hx_pl.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    hx_pl.data.materials.append(hx1500i_mat)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(4 * MM, 6 * MM, shroud_top_z + 0.4 * MM))
    psu_vent = bpy.context.active_object
    psu_vent.name = "PSU_ShroudTopVent"
    psu_vent.scale = (W - 36 * MM, D - 44 * MM, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    psu_vent.data.materials.append(psu_top_mat)

    # Recessed black rubber PSU shroud grommet positioned CLEANLY forward of MP600 beneath the 45° 12V-2x6 cable sweep!
    grom_x, grom_y = -36 * MM, -64 * MM
    add_box("PSU_CableGrommetRim", (26 * MM, 36 * MM, 3.2 * MM), (grom_x, grom_y, shroud_top_z + 1.0 * MM), rubber_grommet, bevel=1.4 * MM)
    add_box("PSU_CableGrommetSlot", (16 * MM, 24 * MM, 3.8 * MM), (grom_x, grom_y, shroud_top_z + 1.2 * MM), fe_fin)

    # Deep matte-black stamped steel Corsair 5000D RapidRoute vertical cable-management bar (ZERO bright silver-grey glare!)
    add_box("Case_RapidRouteBar", (24 * MM, 38 * MM, 304 * MM), (W * 0.5 - 48 * MM, -94 * MM, z0 + 294 * MM), cable_bar_black, bevel=2.2 * MM)
    add_box("Case_RapidRouteRib", (25.2 * MM, 6 * MM, 274 * MM), (W * 0.5 - 48 * MM, -94 * MM, z0 + 294 * MM), rubber_grommet, bevel=0.6 * MM)
    # Recessed black rubber motherboard-tray cable grommet aligned dead-center with the 24-pin ATX bundle
    add_box("Tray_ATX24Grommet", (8 * MM, 22 * MM, 68 * MM), (W * 0.5 - 35 * MM, -74 * MM, z0 + 296 * MM), rubber_grommet, bevel=2.0 * MM)
    # NOTE: Real Corsair 5000D Airflow has NO oversized duplicate CORSAIR wordmark on the side PSU shroud — clean matte steel!

    # 4. Exact-Proportion 244 x 305 mm ATX MSI PRO Z890-P WIFI Motherboard (so 304mm RTX 5090 FE genuinely overhangs right edge by ~50mm!)
    mb_x = W * 0.5 - 40 * MM
    add_box("ATX_MoboSubstrate", (6 * MM, 244 * MM, 305 * MM), (mb_x, 112 * MM, z0 + 302 * MM), steel_dark)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(mb_x - 3.4 * MM, 112 * MM, z0 + 302 * MM))
    mb_face = bpy.context.active_object
    mb_face.name = "ATX_MoboPCB"
    mb_face.scale = (242 * MM, 303 * MM, 1.0)
    mb_face.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    mb_face.data.materials.append(mobo_mat)

    # Prominent sculpted brushed-aluminum + dark-gunmetal Rear I/O Armor with etched PRO Z890-P WIFI plate & fasteners!
    add_box("Mobo_RearIOShroud", (38 * MM, 82 * MM, 144 * MM), (mb_x - 21 * MM, 182 * MM, z0 + 354 * MM), vrm_dark, bevel=3.5 * MM)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(mb_x - 40.4 * MM, 182 * MM, z0 + 354 * MM))
    io_pl = bpy.context.active_object
    io_pl.name = "Mobo_RearIOFace"
    io_pl.scale = (72 * MM, 130 * MM, 1.0)
    io_pl.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    io_pl.data.materials.append(rear_io_mat)
    for sz_io in (-56 * MM, 56 * MM):
        add_cyl(f"Mobo_IOScrew_{sz_io:.2f}", 2.2 * MM, 4 * MM, (mb_x - 40.0 * MM, 156 * MM, z0 + 354 * MM + sz_io), (0, math.pi / 2, 0), fe_trim, 12)

    # Chunky Finned Top VRM Heatsink positioned prominently BELOW top radiator fans & ABOVE the AIO pump!
    add_box("Mobo_VRM_Top", (32 * MM, 124 * MM, 28 * MM), (mb_x - 18 * MM, 110 * MM, z0 + 398 * MM), vrm_metal, bevel=2.5 * MM)
    for k in range(10):
        add_box(f"Mobo_VRMFin_{k}", (34 * MM, 3.4 * MM, 24 * MM), (mb_x - 19 * MM, 56 * MM + k * 11.5 * MM, z0 + 398 * MM), steel_dark)
    # Real 3D VRM ferrite chokes & brushed-aluminum solid capacitors visibly lining the CPU power stages!
    for k in range(8):
        cy_v = 64 * MM + k * 13 * MM
        add_box(f"Mobo_Choke_{k}", (10 * MM, 8.5 * MM, 8.5 * MM), (mb_x - 8.5 * MM, cy_v, z0 + 379 * MM), steel_dark, bevel=0.8 * MM)
        add_cyl(f"Mobo_Cap_{k}", 2.8 * MM, 10 * MM, (mb_x - 9.5 * MM, cy_v, z0 + 369 * MM), (0, math.pi / 2, 0), fe_trim, 14)

    # Exact ORIGIN PC #694619 Dual M.2 NVMe Storage Drives VISIBLY Modeled on MSI PRO Z890-P WIFI:
    # 1) Upper M.2_1: Corsair MP700 PRO 4TB (PCIe Gen5 x4) with TALL 30mm finned extruded aluminum Gen5 heatsink clearly visible above GPU!
    add_box("SSD_MP700PRO_Base", (26 * MM, 90 * MM, 25 * MM), (mb_x - 16 * MM, 118 * MM, z0 + 278 * MM), steel_dark, bevel=1.8 * MM)
    for fk in range(7):
        fz_fin = z0 + 267.5 * MM + fk * 3.5 * MM
        add_box(f"SSD_MP700PRO_Fin_{fk}", (31 * MM, 88 * MM, 1.5 * MM), (mb_x - 18.5 * MM, 118 * MM, fz_fin), vrm_dark, bevel=0.3 * MM)
        add_box(f"SSD_MP700PRO_FinTip_{fk}", (1.6 * MM, 86 * MM, 1.0 * MM), (mb_x - 34.2 * MM, 118 * MM, fz_fin), fe_trim)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(mb_x - 34.6 * MM, 118 * MM, z0 + 278 * MM))
    m7p = bpy.context.active_object
    m7p.name = "SSD_MP700PRO_Label"
    m7p.scale = (74 * MM, 14 * MM, 1.0)
    m7p.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    m7p.data.materials.append(mp700_mat)
    # 2) Lower M.2_3: Corsair MP600 CORE XT R2 1TB (OS Drive) seated 100% UNOBSTRUCTED below GPU & cleanly LEFT of 12V-2x6 cable!
    add_box("SSD_MP600_PCB", (10 * MM, 94 * MM, 23 * MM), (mb_x - 10 * MM, 168 * MM, z0 + 148 * MM), steel_dark, bevel=0.8 * MM)
    add_box("SSD_MP600_Connector", (13 * MM, 10 * MM, 24 * MM), (mb_x - 11 * MM, 120 * MM, z0 + 148 * MM), rubber_grommet)
    add_cyl("SSD_MP600_Latch", 3.2 * MM, 8 * MM, (mb_x - 11 * MM, 216 * MM, z0 + 148 * MM), (0, math.pi / 2, 0), fe_trim, 12)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(mb_x - 15.6 * MM, 168 * MM, z0 + 148 * MM))
    m6p = bpy.context.active_object
    m6p.name = "SSD_MP600_Label"
    m6p.scale = (86 * MM, 21 * MM, 1.0)
    m6p.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    m6p.data.materials.append(mp600_mat)

    # Brushed-silver MSI PRO Z890-P WIFI PCH chipset heatsink cleanly positioned on lower-front of 244mm ATX board
    add_box("Mobo_ChipsetHS", (22 * MM, 82 * MM, 72 * MM), (mb_x - 13 * MM, 30 * MM, z0 + 186 * MM), steel_matte, bevel=2.8 * MM)
    add_box("Mobo_ChipsetFace", (2.4 * MM, 74 * MM, 64 * MM), (mb_x - 24.4 * MM, 30 * MM, z0 + 186 * MM), vrm_metal, bevel=1.0 * MM)
    for cg in range(4):
        add_box(f"Mobo_ChipGroove_{cg}", (3.2 * MM, 64 * MM, 4.2 * MM), (mb_x - 25.0 * MM, 30 * MM, z0 + 165 * MM + cg * 13.5 * MM), vrm_dark)
    # 4 corner motherboard mounting standoffs / stainless Philips screws visible on PCB
    for smy, smz in [(204 * MM, z0 + 156 * MM), (20 * MM, z0 + 156 * MM), (-2 * MM, z0 + 258 * MM), (-2 * MM, z0 + 368 * MM)]:
        add_cyl(f"Mobo_MountScrew_{smy:.2f}_{smz:.2f}", 3.0 * MM, 5 * MM, (mb_x - 5.0 * MM, smy, smz), (0, math.pi / 2, 0), fe_trim, 12)

    # Steel-armored PCIe x16 slots + CMOS battery + Gold Nichicon audio caps (leaves M.2_3 at z0+162mm 100% unobstructed!)
    add_box("Mobo_PCIeSlot1", (14 * MM, 114 * MM, 11 * MM), (mb_x - 9 * MM, 136 * MM, z0 + 234 * MM), fe_trim, bevel=0.8 * MM)
    add_box("Mobo_PCIeSlot2", (15 * MM, 114 * MM, 10 * MM), (mb_x - 9.5 * MM, 134 * MM, z0 + 190 * MM), fe_trim, bevel=0.8 * MM)
    add_box("Mobo_PCIeSlot2Inner", (16 * MM, 102 * MM, 4.0 * MM), (mb_x - 10 * MM, 134 * MM, z0 + 190 * MM), rubber_grommet)
    add_cyl("Mobo_CMOSBat", 9.5 * MM, 6 * MM, (mb_x - 6.5 * MM, 180 * MM, z0 + 196 * MM), (0, math.pi / 2, 0), fe_trim, 18)
    for ak in range(5):
        add_cyl(f"Mobo_AudioCap_{ak}", 3.6 * MM, 10 * MM, (mb_x - 8.5 * MM, 214 * MM, z0 + 158 * MM + ak * 11 * MM), (0, math.pi / 2, 0), cap_gold, 14)

    # Clearly Visible Corsair Premium Individually-Sleeved Type-4 Gen 4 24-Pin ATX Cable (on true front edge of 244mm ATX board, dual machined combs!)
    atx_z = z0 + 296 * MM
    add_box("Mobo_ATX24_Header", (18 * MM, 14 * MM, 58 * MM), (mb_x - 11 * MM, -4 * MM, atx_z), steel_dark, bevel=1.2 * MM)
    for row_a, ox_a in enumerate([-3.2 * MM, 3.2 * MM]):
        for k in range(12):
            z_off = -23.1 * MM + k * 4.2 * MM
            p0_24 = (mb_x - 18 * MM + ox_a * 0.5, -8 * MM, atx_z + z_off)
            p1_24 = (mb_x - 46 * MM + ox_a, -26 * MM, atx_z + z_off)
            p2_24 = (mb_x - 40 * MM + ox_a, -58 * MM, atx_z + z_off)
            p3_24 = (mb_x + 6 * MM, -76 * MM, atx_z + z_off)
            add_bezier_tube(f"Cable_ATX24_{row_a}_{k}", p0_24, p1_24, p2_24, p3_24, 1.85 * MM, braid_accent if (k + row_a) % 2 == 0 else braid_mat, steps=24)
    for ci24, t24 in enumerate([0.30, 0.62]):
        c24_pos = eval_cubic_bezier((mb_x - 18 * MM, -8 * MM, atx_z), (mb_x - 46 * MM, -26 * MM, atx_z), (mb_x - 40 * MM, -58 * MM, atx_z), (mb_x + 6 * MM, -76 * MM, atx_z), t24)
        c24_tan = eval_cubic_bezier_tangent((mb_x - 18 * MM, -8 * MM, atx_z), (mb_x - 46 * MM, -26 * MM, atx_z), (mb_x - 40 * MM, -58 * MM, atx_z), (mb_x + 6 * MM, -76 * MM, atx_z), t24)
        rot_24 = Vector((0, -1, 0)).rotation_difference(c24_tan).to_euler()
        add_box(f"Cable_ATX24_Comb_{ci24}", (11.5 * MM, 5.2 * MM, 55 * MM), c24_pos, vrm_dark, bevel=0.8 * MM, rot=(rot_24.x, rot_24.y, rot_24.z))

    # Clearly Visible Individually-Sleeved Dual 8-Pin EPS CPU Power Cables above top silver VRM heatsink (cleanly BELOW top fans!)
    add_box("Mobo_EPS8_Header", (18 * MM, 34 * MM, 13 * MM), (mb_x - 11 * MM, 148 * MM, z0 + 414 * MM), rubber_grommet, bevel=0.8 * MM)
    for ek in range(8):
        ey = 134 * MM + ek * 4.0 * MM
        p0_e = (mb_x - 19 * MM, ey, z0 + 415 * MM)
        p1_e = (mb_x - 36 * MM, ey, z0 + 427 * MM)
        p2_e = (mb_x - 24 * MM, ey + 2 * MM, z0 + 440 * MM)
        p3_e = (mb_x + 8 * MM, ey + 4 * MM, z0 + 442 * MM)
        add_bezier_tube(f"Cable_EPS8_{ek}", p0_e, p1_e, p2_e, p3_e, 1.85 * MM, braid_accent if ek % 2 == 0 else braid_mat, steps=20)
    ce_pos = eval_cubic_bezier((mb_x - 19 * MM, 148 * MM, z0 + 415 * MM), (mb_x - 36 * MM, 148 * MM, z0 + 427 * MM), (mb_x - 24 * MM, 150 * MM, z0 + 440 * MM), (mb_x + 8 * MM, 152 * MM, z0 + 442 * MM), 0.42)
    add_box("Cable_EPS8_Comb", (9.0 * MM, 36 * MM, 4.8 * MM), ce_pos, vrm_dark, bevel=0.6 * MM)

    # Exact ORIGIN PC #694619 Memory: Corsair VENGEANCE 96GB (2x48GB) DDR5 6400MT/s (NON-RGB, low-profile 35mm black aluminum!)
    # All 4 black DDR5 DIMM slots on MSI PRO Z890-P WIFI are modeled; slots A2 (i=1) & B2 (i=3) hold the 2x48GB sticks!
    for i in range(4):
        ry = 46 * MM - i * 12.2 * MM
        add_box(f"DIMM_Slot_{i}", (11 * MM, 7.2 * MM, 126 * MM), (mb_x - 6.5 * MM, ry, z0 + 346 * MM), rubber_grommet)
        # Dual-channel latch clips at top & bottom of every DIMM slot
        for lz in (-64 * MM, 64 * MM):
            add_box(f"DIMM_Latch_{i}_{lz:.2f}", (13 * MM, 7.6 * MM, 5.5 * MM), (mb_x - 7.5 * MM, ry, z0 + 346 * MM + lz), steel_matte, bevel=0.5 * MM)
        if i in (1, 3):
            # Authentic 35mm low-profile solid matte-black aluminum Corsair VENGEANCE DDR5 heatspreader (ZERO RGB bars!)
            add_box(f"DDR5_Vengeance_{i}", (35 * MM, 7.6 * MM, 122 * MM), (mb_x - 24.5 * MM, ry, z0 + 346 * MM), ram_spreader, bevel=1.3 * MM)
            # Crisp anodized-aluminum top spine ridge catching cool cyan RGB & window light so both sticks pop cleanly!
            add_box(f"DDR5_VengeanceTop_{i}", (3.4 * MM, 5.6 * MM, 118 * MM), (mb_x - 42.2 * MM, ry, z0 + 346 * MM), fe_trim, bevel=0.6 * MM)
            bpy.ops.mesh.primitive_plane_add(size=1.0, location=(mb_x - 44.0 * MM, ry, z0 + 346 * MM))
            rs = bpy.context.active_object
            rs.name = f"DDR5_VengeanceBrand_{i}"
            rs.scale = (6.2 * MM, 114 * MM, 1.0)
            rs.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
            bpy.ops.object.transform_apply(rotation=True, scale=True)
            rs.data.materials.append(ram_side_mat)

    # 5. Corsair iCUE LINK TITAN 360 RX RGB AIO Cooler:
    #    - Silky-smooth 64-segment diffused RGB acrylic perimeter ring + sculpted translucent smoked CapSwap geometric dome!
    pump_y = 116 * MM
    pump_z = z0 + 344 * MM
    add_box("AIO_TITAN_Base", (30 * MM, 74 * MM, 74 * MM), (mb_x - 19 * MM, pump_y, pump_z), steel_dark, bevel=10.0 * MM, segments=4, smooth=True)
    # Recessed dark-anodized collar + continuous smooth diffused cyan-teal 20-LED RGB acrylic ring (ZERO faceted white blocks!)
    add_cyl("AIO_TITAN_Collar", 36.5 * MM, 14 * MM, (mb_x - 38 * MM, pump_y, pump_z), (0, math.pi / 2, 0), vrm_dark, 48)
    add_torus("AIO_TITAN_RGBHalo", 34.5 * MM, 3.2 * MM, (mb_x - 45.5 * MM, pump_y, pump_z), (0, math.pi / 2, 0), rgb_cyan)
    # Smooth stepped dark-smoked CapSwap dome housing with subtle chamfered geometric rim & recessed Corsair sails face
    add_cyl("AIO_TITAN_CapTier1", 32.0 * MM, 12 * MM, (mb_x - 48.5 * MM, pump_y, pump_z), (0, math.pi / 2, 0), steel_dark, 48)
    add_torus("AIO_TITAN_CapRim", 30.2 * MM, 1.8 * MM, (mb_x - 54.5 * MM, pump_y, pump_z), (0, math.pi / 2, 0), vrm_dark)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(mb_x - 55.2 * MM, pump_y, pump_z))
    lcd_obj = bpy.context.active_object
    lcd_obj.name = "AIO_TITAN_CapFace"
    lcd_obj.scale = (50 * MM, 50 * MM, 1.0)
    lcd_obj.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    lcd_obj.data.materials.append(lcd_mat)
    # Smooth translucent smoked-acrylic domed CapSwap lens crowning the pump face
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=31.0 * MM, radius2=22.0 * MM, depth=7.0 * MM, location=(mb_x - 58.2 * MM, pump_y, pump_z), rotation=(0, -math.pi / 2, 0))
    dome_shell = bpy.context.active_object
    dome_shell.name = "AIO_TITAN_CapGlassCrown"
    for p in dome_shell.data.polygons:
        p.use_smooth = True
    dome_shell.data.materials.append(cap_dome_mat)

    # Full-thickness 360mm radiator core with visible corrugated aluminum fin side band & clearly visible front coolant end-tank inside viewing window!
    rad_z = z0 + H - 46 * MM
    add_box("AIO_Radiator360", (124 * MM, 368 * MM, 30 * MM), (4 * MM, 24 * MM, rad_z), steel_matte, bevel=1.8 * MM)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(-58.6 * MM, 24 * MM, rad_z))
    rf = bpy.context.active_object
    rf.name = "AIO_RadSideFins"
    rf.scale = (336 * MM, 22 * MM, 1.0)
    rf.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    rf.data.materials.append(rad_fin_mat)
    add_box("AIO_RadFrontTank", (126 * MM, 44 * MM, 36 * MM), (4 * MM, -158 * MM, rad_z - 3 * MM), steel_matte, bevel=2.2 * MM)

    # Knurled brushed-chrome compression fittings at BOTH pump block AND clearly visible front radiator end-tank + braided nylon hoses!
    for idx, (dz_f, dy_rad) in enumerate([(10 * MM, -148 * MM), (-10 * MM, -166 * MM)]):
        add_cyl(f"AIO_PumpFit_{idx}", 9.2 * MM, 16 * MM, (mb_x - 42 * MM, pump_y - 36 * MM, pump_z + dz_f), (math.pi / 2, 0, 0), fe_trim, 18)
        add_cyl(f"AIO_PumpNut_{idx}", 10.4 * MM, 6 * MM, (mb_x - 42 * MM, pump_y - 42 * MM, pump_z + dz_f), (math.pi / 2, 0, 0), vrm_metal, 6)
        add_cyl(f"AIO_RadFit_{idx}", 9.2 * MM, 20 * MM, (-34 * MM, dy_rad, rad_z - 28 * MM), (0, 0, 0), fe_trim, 18)
        add_cyl(f"AIO_RadNut_{idx}", 10.8 * MM, 7 * MM, (-34 * MM, dy_rad, rad_z - 35 * MM), (0, 0, 0), vrm_metal, 6)
        p0_h = (mb_x - 42 * MM, pump_y - 44 * MM, pump_z + dz_f)
        p1_h = (mb_x - 76 * MM, -10 * MM, pump_z + 18 * MM + dz_f * 0.6)
        p2_h = (-44 * MM, dy_rad + 22 * MM, pump_z + 32 * MM + dz_f * 0.4)
        p3_h = (-34 * MM, dy_rad, rad_z - 36 * MM)
        add_bezier_tube(f"AIO_Tube_{idx}", p0_h, p1_h, p2_h, p3_h, 6.8 * MM, hose_mat, steps=36)

    # 6. Seven Authentic Corsair iCUE LINK RX120 RGB Fans (3 Front + 3 Top + 1 Rear — ALL 7 hub-illuminated with translucent blades & diffused side windows!)
    def add_square_120mm_fan(name, loc, axis, rgb_m):
        fsz = 120 * MM
        thick = 25 * MM
        wall = 11 * MM
        half = fsz * 0.5 - wall * 0.5
        if axis == "Y":
            rot_ring = (math.pi / 2, 0, 0)
            add_box(f"{name}_FrameT", (fsz, thick, wall), (loc[0], loc[1], loc[2] + half), fan_frame_mat, bevel=2.0 * MM)
            add_box(f"{name}_FrameB", (fsz, thick, wall), (loc[0], loc[1], loc[2] - half), fan_frame_mat, bevel=2.0 * MM)
            add_box(f"{name}_FrameL", (wall, thick, fsz - wall * 2), (loc[0] - half, loc[1], loc[2]), fan_frame_mat, bevel=2.0 * MM)
            add_box(f"{name}_FrameR", (wall, thick, fsz - wall * 2), (loc[0] + half, loc[1], loc[2]), fan_frame_mat, bevel=2.0 * MM)
            for sx in (-1, 1):
                for sz in (-1, 1):
                    add_cyl(f"{name}_Screw_{sx}_{sz}", 2.4 * MM, thick + 1 * MM, (loc[0] + sx * 52 * MM, loc[1], loc[2] + sz * 52 * MM), rot_ring, fe_trim, 12)
        else:
            rot_ring = (0, 0, 0)
            add_box(f"{name}_FrameF", (fsz, wall, thick), (loc[0], loc[1] - half, loc[2]), fan_frame_mat, bevel=2.0 * MM)
            add_box(f"{name}_FrameBk", (fsz, wall, thick), (loc[0], loc[1] + half, loc[2]), fan_frame_mat, bevel=2.0 * MM)
            add_box(f"{name}_FrameL", (wall, fsz - wall * 2, thick), (loc[0] - half, loc[1], loc[2]), fan_frame_mat, bevel=2.0 * MM)
            add_box(f"{name}_FrameR", (wall, fsz - wall * 2, thick), (loc[0] + half, loc[1], loc[2]), fan_frame_mat, bevel=2.0 * MM)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    add_cyl(f"{name}_Screw_{sx}_{sy}", 2.4 * MM, thick + 1 * MM, (loc[0] + sx * 52 * MM, loc[1] + sy * 52 * MM, loc[2]), rot_ring, fe_trim, 12)

        add_torus(f"{name}_InnerRing", 53 * MM, 4.2 * MM, loc, rot_ring, fan_frame_mat)
        off_d = 9.0 * MM
        if axis == "Y":
            # Dual-sided 8-LED RGB hub illumination so front intake fans glow vividly BOTH through the front mesh AND from inside the glass!
            add_torus(f"{name}_HubRGB_F", 21.0 * MM, 3.6 * MM, (loc[0], loc[1] - off_d * 0.72, loc[2]), rot_ring, rgb_m)
            add_torus(f"{name}_HubRGB_B", 21.0 * MM, 3.6 * MM, (loc[0], loc[1] + off_d * 0.72, loc[2]), rot_ring, rgb_m)
            # Soft diffused Corsair RX120 side window with dark bezel frame (NO flat solid-white strip!)
            add_box(f"{name}_SideBezel", (3.0 * MM, 14.0 * MM, 80 * MM), (loc[0] - fsz * 0.5 - 0.2 * MM, loc[1], loc[2]), fan_frame_mat, bevel=0.8 * MM)
            bpy.ops.mesh.primitive_plane_add(size=1.0, location=(loc[0] - fsz * 0.5 - 1.9 * MM, loc[1], loc[2]))
            swp = bpy.context.active_object
            swp.name = f"{name}_SideWindow"
            swp.scale = (72 * MM, 10.5 * MM, 1.0)
            swp.rotation_euler = (math.pi / 2, math.pi / 2, -math.pi / 2)
            bpy.ops.object.transform_apply(rotation=True, scale=True)
            swp.data.materials.append(rx_side_mat)
        else:
            add_torus(f"{name}_HubRGB_B", 21.0 * MM, 3.6 * MM, (loc[0], loc[1], loc[2] - off_d * 0.72), rot_ring, rgb_m)
            add_box(f"{name}_SideBezel", (3.0 * MM, 86 * MM, 10.5 * MM), (loc[0] - fsz * 0.5 - 0.2 * MM, loc[1], loc[2]), fan_frame_mat, bevel=0.8 * MM)
            bpy.ops.mesh.primitive_plane_add(size=1.0, location=(loc[0] - fsz * 0.5 - 1.9 * MM, loc[1], loc[2]))
            swp = bpy.context.active_object
            swp.name = f"{name}_SideRGBSlot"
            swp.scale = (78 * MM, 7.2 * MM, 1.0)
            swp.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
            bpy.ops.object.transform_apply(rotation=True, scale=True)
            swp.data.materials.append(rx_side_mat)
        add_cyl(f"{name}_Hub", 20 * MM, 20 * MM, loc, rot_ring, steel_matte, 28)
        add_cyl(f"{name}_HubCap", 14 * MM, 21.5 * MM, loc, rot_ring, fe_trim, 24)
        add_curved_fan_blades(f"{name}_Blades", loc, axis, fan_blade_mat, count=7)

    # Position 3 front RX120 RGB intake fans right behind the triangular front airflow mesh so all 3 glow clearly from front & side!
    for fi, fz in enumerate([138 * MM, 256 * MM, 374 * MM]):
        add_square_120mm_fan(f"Fan_Front_{fi}", (0, -D * 0.5 + 32 * MM, z0 + fz), "Y", rgb_cyan if fi % 2 == 0 else rgb_mint)
    for fi, fy in enumerate([-88 * MM, 32 * MM, 152 * MM]):
        add_square_120mm_fan(f"Fan_Top_{fi}", (4 * MM, fy, z0 + H - 74 * MM), "Z", rgb_mint if fi % 2 == 0 else rgb_cyan)
    add_square_120mm_fan("Fan_Rear", (0, D * 0.5 - 32 * MM, z0 + 372 * MM), "Y", rgb_cyan)

    # 7. Flagship NVIDIA GeForce RTX 5090 Founders Edition (304 x 137 x 28 mm — razor-sleek TRUE 2-slot double flow-through!):
    #    - Overhangs the 244mm ATX motherboard front edge by ~46mm (true-to-life 304mm vs 244mm proportion!)
    #    - Deeply recessed 45° side 12V-2x6 pocket with 12 individually-sleeved black paracord wires & 3 machined combs!
    gpu_cx = mb_x - GPU_W * 0.5 - 6 * MM
    gpu_cy = D * 0.5 - 12 * MM - GPU_L * 0.5
    gpu_cz = z0 + 234 * MM

    # Brushed-steel TRUE 2-slot PCIe rear mounting bracket (strictly 2 slots = 31mm tall!)
    add_box("RTX5090_IOBracket", (GPU_W + 20 * MM, 18 * MM, GPU_H + 3 * MM), (gpu_cx + 4 * MM, D * 0.5 - 17 * MM, gpu_cz), fe_trim, bevel=0.8 * MM)
    for sz in (-8 * MM, 8 * MM):
        add_cyl(f"RTX5090_BracketScrew_{sz:.2f}", 3.0 * MM, 6 * MM, (gpu_cx - GPU_W * 0.5 + 10 * MM, D * 0.5 - 24 * MM, gpu_cz + sz), (math.pi / 2, 0, 0), fe_trim, 14)

    # Center sculpted hourglass PCB core + beveled die-cast satin-titanium Double-V / X-frame + ultra-fine recessed inner-V light guides!
    rail_w = 11 * MM
    add_box("RTX5090_RailGlass", (rail_w, GPU_L - 14 * MM, GPU_H), (gpu_cx - GPU_W * 0.5 + rail_w * 0.5, gpu_cy, gpu_cz), titanium, bevel=4.4 * MM, segments=5, smooth=True)
    add_box("RTX5090_RailMobo", (rail_w, GPU_L - 14 * MM, GPU_H), (gpu_cx + GPU_W * 0.5 - rail_w * 0.5, gpu_cy, gpu_cz), titanium, bevel=4.4 * MM, segments=5, smooth=True)
    add_box("RTX5090_EndFront", (GPU_W, 24 * MM, GPU_H), (gpu_cx, gpu_cy - GPU_L * 0.5 + 12 * MM, gpu_cz), titanium, bevel=8.5 * MM, segments=6, smooth=True)
    add_box("RTX5090_EndRear", (GPU_W, 24 * MM, GPU_H), (gpu_cx, gpu_cy + GPU_L * 0.5 - 12 * MM, gpu_cz), titanium, bevel=8.5 * MM, segments=6, smooth=True)
    add_box("RTX5090_CenterCore", (GPU_W - rail_w * 1.4, 84 * MM, GPU_H - 1.0 * MM), (gpu_cx, gpu_cy, gpu_cz), titanium, bevel=2.4 * MM, segments=3, smooth=True)

    x_z = gpu_cz + GPU_H * 0.5 - 0.5 * MM
    for sy in (-1, 1):
        for sx in (-1, 1):
            ang = sx * sy * math.radians(36)
            add_box(f"RTX5090_XArm_{sx}_{sy}", (42 * MM, 11.0 * MM, 2.6 * MM), (gpu_cx + sx * 42 * MM, gpu_cy + sy * 48 * MM, x_z), fe_xframe, bevel=1.1 * MM, segments=3, rot=(0, 0, ang), smooth=True)
            add_box(f"RTX5090_XVLed_{sx}_{sy}", (34 * MM, 1.1 * MM, 1.0 * MM), (gpu_cx + sx * 40 * MM, gpu_cy + sy * 43 * MM, x_z + 1.1 * MM), fe_white_led, bevel=0.2 * MM, rot=(0, 0, ang))

    # Seamless center dark-gunmetal RTX 5090 top plate
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(gpu_cx, gpu_cy, gpu_cz + GPU_H * 0.5 + 0.15 * MM))
    g_top = bpy.context.active_object
    g_top.name = "RTX5090_TopBackplate"
    g_top.scale = (64 * MM, 54 * MM, 1.0)
    g_top.rotation_euler = (0, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    g_top.data.materials.append(gpu_top_mat)

    # TRUE OPEN SEE-THROUGH DOUBLE FLOW-THROUGH HEATSINK FIN ARRAYS:
    # Deep 24mm vertically stacked anodized fins with crisp shadow channels & subtle beveled fin tops (authentic 3D depth!)
    for end_y in (-88 * MM, 88 * MM):
        for k in range(14):
            fy_fin = gpu_cy + end_y - 39.0 * MM + k * 6.00 * MM
            add_box(f"RTX5090_Fin_{end_y:.2f}_{k}", (GPU_W - rail_w * 2.0, 1.65 * MM, 23.5 * MM), (gpu_cx, fy_fin, gpu_cz - 0.8 * MM), fe_fin_blade)

    for fi, f_off in enumerate([-88 * MM, 88 * MM]):
        add_torus(f"RTX5090_FanRing_{fi}", 48 * MM, 2.2 * MM, (gpu_cx, gpu_cy + f_off, gpu_cz - GPU_H * 0.5 + 2.5 * MM), (0, 0, 0), steel_dark)
        add_cyl(f"RTX5090_FanHub_{fi}", 15 * MM, 4.0 * MM, (gpu_cx, gpu_cy + f_off, gpu_cz - GPU_H * 0.5 + 2.5 * MM), (0, 0, 0), titanium, 20)

    # Crisp 2048px backlit GEFORCE RTX 5090 side badge (strictly left of the 45° 12V-2x6 pocket — 100% UNOBSTRUCTED!)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(gpu_cx - GPU_W * 0.5 - 0.25 * MM, gpu_cy, gpu_cz))
    g_side = bpy.context.active_object
    g_side.name = "RTX5090_SideNameplate"
    g_side.scale = (GPU_L - 32 * MM, GPU_H - 8 * MM, 1.0)
    g_side.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    g_side.data.materials.append(gpu_side_mat)

    # Flush Deeply Recessed 45°-Angled Side 16-Pin 12V-2x6 Connector Cavity INSIDE the RTX 5090 FE Side Frame (ZERO protruding blocky nub!)
    plug_y = gpu_cy - 58 * MM
    add_box("RTX5090_12V2x6_RecessPocket", (11 * MM, 24 * MM, 14 * MM), (gpu_cx - GPU_W * 0.5 + 5.0 * MM, plug_y, gpu_cz), fe_fin, bevel=0.8 * MM, rot=(0, 0, math.radians(-45)))
    add_box("RTX5090_12V2x6_PlugBody", (12 * MM, 16 * MM, 9.8 * MM), (gpu_cx - GPU_W * 0.5 + 2.0 * MM, plug_y - 1.5 * MM, gpu_cz), rubber_grommet, bevel=1.2 * MM, rot=(0, 0, math.radians(-45)))

    # Smooth plush individually-sleeved Corsair 600W PCIe 5.1 12V-2x6 black cable sweeping naturally forward & cleanly down into PSU grommet (100% CLEAR of MP600!)
    p0_16 = (gpu_cx - GPU_W * 0.5 - 1.5 * MM, plug_y - 4.0 * MM, gpu_cz - 1.0 * MM)
    p1_16 = (gpu_cx - GPU_W * 0.5 - 18 * MM, plug_y - 36 * MM, gpu_cz - 16 * MM)
    p2_16 = (grom_x - 14 * MM, grom_y + 6 * MM, shroud_top_z + 58 * MM)
    p3_16 = (grom_x, grom_y, shroud_top_z - 3 * MM)

    # Dense plush 2x4 = 8 thick smooth braided conductors (zero thin-wire aliasing or jagged silhouette!)
    for row_i, ox in enumerate([-2.1 * MM, 2.1 * MM]):
        for col_i in range(4):
            oy = (-1.5 + col_i) * 4.0 * MM
            add_bezier_tube(
                f"RTX5090_12V2x6_Wire_{row_i}_{col_i}",
                (p0_16[0] + ox * 0.55, p0_16[1] + oy * 0.68, p0_16[2]),
                (p1_16[0] + ox, p1_16[1] + oy, p1_16[2]),
                (p2_16[0] + ox, p2_16[1] + oy, p2_16[2]),
                (p3_16[0] + ox * 0.75, p3_16[1] + oy * 0.72, p3_16[2]),
                2.15 * MM,
                braid_accent if col_i in (1, 2) else braid_mat,
                steps=64,
            )
    # Two sleek flush matte-black cable combs aligned smoothly along the curved centerline
    for ci, t_comb in enumerate([0.34, 0.70]):
        cpos = eval_cubic_bezier(p0_16, p1_16, p2_16, p3_16, t_comb)
        ctan = eval_cubic_bezier_tangent(p0_16, p1_16, p2_16, p3_16, t_comb)
        rot_q = Vector((0, 0, -1)).rotation_difference(ctan).to_euler()
        add_box(f"RTX5090_12V2x6_Comb_{ci}", (8.8 * MM, 18.8 * MM, 4.6 * MM), cpos, rubber_grommet, bevel=0.8 * MM, rot=(rot_q.x, rot_q.y, rot_q.z))

    # 8. Single-sheet Flush Smoked Tempered Glass Side Panel + Subtle Dark Smoked-Glass Perimeter Rim
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(-W * 0.5 + 1.2 * MM, 0, z0 + H * 0.5))
    glass_p = bpy.context.active_object
    glass_p.name = "Case_TemperedGlass"
    glass_p.scale = (D - 18 * MM, H - 18 * MM, 1.0)
    glass_p.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    glass_p.data.materials.append(glass_mat)
    # Subtle dark smoked-glass chamfered thickness trim (dark slate-charcoal, NOT bright green!)
    add_box("Case_GlassThicknessRim", (2.2 * MM, 2.2 * MM, H - 26 * MM), (-W * 0.5 + 0.8 * MM, -D * 0.5 + 11 * MM, z0 + H * 0.5), glass_rim_mat, bevel=0.4 * MM)

    out_blend = os.path.join(OUT_DIR, "corsair_rtx5090.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_corsair_rtx5090()
