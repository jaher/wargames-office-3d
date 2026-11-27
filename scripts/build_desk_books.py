#!/usr/bin/env python3
"""
Headless Blender builder for realistic stacked CS & Math desk books
under the Anglepoise lamp (`assets/models/desk_books.glb`):

  1. Bottom: Concrete Mathematics (Graham, Knuth, Patashnik — Addison-Wesley hardcover)
             242 x 186 x 38 mm, slate-navy cloth boards overhanging cream lined pages,
             curved convex spine with raised hubs & woven gold/burgundy headband.
  2. Middle: Structure and Interpretation of Computer Programs — SICP (MIT Press hardcover)
             234 x 182 x 36 mm, deep royal purple cloth, gold-cream typography & wizard/lambda motif,
             overhanging boards, curved spine, cream page block & headband, rotated +9 deg.
  3. Top:    The C Programming Language, 2nd Ed. (Kernighan & Ritchie — Prentice Hall paperback)
             226 x 172 x 19 mm, iconic stark-white paperback with bold blue 'C' and red 'ANSI C',
             flush-trimmed softcover, visible cream page block, rotated -7 deg.

Run:
    blender --background --python scripts/build_desk_books.py
"""
import math
import os
import random
import bpy
import bmesh
from mathutils import Vector, Matrix
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_GLB = os.path.join(ROOT, "assets", "models", "desk_books.glb")
OUT_BLEND = os.path.join(ROOT, "assets", "blender", "desk_books.blend")
TEX_DIR = os.path.join(ROOT, "assets", "blender", "textures")
PREVIEW_PNG = "/tmp/desk_books_preview.png"
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)


def load_font(size, bold=False, serif=False):
    candidates = []
    if serif:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def add_paper_grain(img, amount=8, seed=11):
    rng = random.Random(seed)
    px = img.load()
    w, h = img.size
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            d = rng.randint(-amount, amount)
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))


def paint_book_textures():
    """Paint one compact 1024x1024 atlas containing front covers, spines, and lined page edges for all 3 desk books."""
    W, H = 1024, 1024
    img = Image.new("RGB", (W, H), (236, 228, 210))
    draw = ImageDraw.Draw(img)

    # Layout in 1024x1024 (PIL y=0 top -> UV v=1 top):
    #   Row 0 (y=0..460):
    #     Book 0 (Concrete Math) Cover: x=0..340, y=0..460
    #     Book 1 (SICP)          Cover: x=340..680, y=0..460
    #     Book 2 (K&R 2e)        Cover: x=680..1024, y=0..460
    #   Row 1 (y=460..760):
    #     Book 0 Spine (horizontal text): x=0..512, y=460..560
    #     Book 1 Spine (horizontal text): x=0..512, y=560..660
    #     Book 2 Spine (horizontal text): x=0..512, y=660..760
    #     Page Edges (lined ivory leaves): x=512..1024, y=460..1024
    #   Row 2 (y=760..1024):
    #     Book cloth back/rim patches:
    #       Book 0 Navy:   x=0..170, y=760..1024
    #       Book 1 Purple: x=170..340, y=760..1024
    #       Book 2 White:  x=340..512, y=760..1024

    # ── Book 0: Concrete Mathematics (Addison-Wesley, slate-navy cloth + warm cream/gold typography) ──
    x0, y0, cw, ch = 0, 0, 340, 460
    draw.rectangle([x0, y0, x0 + cw, y0 + ch], fill=(32, 54, 84))
    draw.rectangle([x0 + 18, y0 + 22, x0 + cw - 18, y0 + ch - 22], outline=(222, 200, 142), width=3)
    draw.rectangle([x0 + 26, y0 + 30, x0 + cw - 26, y0 + ch - 30], outline=(222, 200, 142), width=1)
    draw.rectangle([x0, y0 + 220, x0 + cw, y0 + 236], fill=(214, 186, 118))
    draw.text((x0 + cw // 2, y0 + 95), "CONCRETE", fill=(246, 240, 224), font=load_font(34, True, True), anchor="mm")
    draw.text((x0 + cw // 2, y0 + 138), "MATHEMATICS", fill=(246, 240, 224), font=load_font(30, True, True), anchor="mm")
    draw.text((x0 + cw // 2, y0 + 182), "A Foundation for Computer Science", fill=(218, 208, 182), font=load_font(14, False, True), anchor="mm")
    # Classic Sigma sum motif
    draw.text((x0 + cw // 2, y0 + 298), "Σ  ⌊x⌋  (n/k)", fill=(224, 198, 132), font=load_font(28, True, True), anchor="mm")
    draw.text((x0 + cw // 2, y0 + 365), "GRAHAM · KNUTH · PATASHNIK", fill=(242, 236, 220), font=load_font(14, True, False), anchor="mm")
    draw.text((x0 + cw // 2, y0 + 408), "ADDISON-WESLEY", fill=(208, 188, 140), font=load_font(13, True, True), anchor="mm")

    # ── Book 1: SICP (MIT Press deep royal purple cloth + wizard/lambda emblem + gold-cream serif) ──
    x1, y1 = 340, 0
    draw.rectangle([x1, y1, x1 + cw, y1 + ch], fill=(66, 36, 94))
    draw.rectangle([x1 + 20, y1 + 24, x1 + cw - 20, y1 + 36], fill=(222, 190, 96))
    draw.text((x1 + cw // 2, y1 + 78), "Structure and", fill=(248, 242, 228), font=load_font(26, True, True), anchor="mm")
    draw.text((x1 + cw // 2, y1 + 110), "Interpretation of", fill=(248, 242, 228), font=load_font(26, True, True), anchor="mm")
    draw.text((x1 + cw // 2, y1 + 142), "Computer Programs", fill=(248, 242, 228), font=load_font(25, True, True), anchor="mm")
    # Stylized glowing gold lambda emblem (nod to the Wizard Book!)
    cx_l, cy_l = x1 + cw // 2, y1 + 258
    draw.ellipse([cx_l - 62, cy_l - 62, cx_l + 62, cy_l + 62], outline=(232, 200, 108), width=3, fill=(52, 26, 76))
    draw.ellipse([cx_l - 50, cy_l - 50, cx_l + 50, cy_l + 50], outline=(196, 166, 92), width=1)
    draw.text((cx_l, cy_l + 2), "λ", fill=(242, 212, 118), font=load_font(68, True, True), anchor="mm")
    draw.text((x1 + cw // 2, y1 + 362), "ABELSON · SUSSMAN", fill=(244, 236, 216), font=load_font(16, True, False), anchor="mm")
    draw.text((x1 + cw // 2, y1 + 388), "SECOND EDITION", fill=(214, 192, 140), font=load_font(12, True, False), anchor="mm")
    draw.text((x1 + cw // 2, y1 + 422), "THE MIT PRESS", fill=(238, 230, 214), font=load_font(13, True, False), anchor="mm")

    # ── Book 2: K&R — The C Programming Language, 2nd Ed. (Prentice Hall matte off-white + bold blue C + red ANSI) ──
    x2, y2, cw2 = 680, 0, 344
    draw.rectangle([x2, y2, x2 + cw2, y2 + ch], fill=(224, 222, 214))
    draw.rectangle([x2 + 22, y2 + 24, x2 + cw2 - 22, y2 + 36], fill=(18, 68, 146))
    draw.rectangle([x2 + 22, y2 + ch - 36, x2 + cw2 - 22, y2 + ch - 24], fill=(18, 68, 146))
    draw.text((x2 + cw2 // 2, y2 + 76), "THE C PROGRAMMING", fill=(16, 20, 28), font=load_font(23, True, False), anchor="mm")
    draw.text((x2 + cw2 // 2, y2 + 105), "LANGUAGE", fill=(16, 20, 28), font=load_font(23, True, False), anchor="mm")
    # Iconic giant royal-blue C + crimson ANSI C stamp!
    draw.text((x2 + cw2 // 2, y2 + 222), "C", fill=(16, 68, 152), font=load_font(158, True, False), anchor="mm")
    draw.rectangle([x2 + 68, y2 + 306, x2 + cw2 - 68, y2 + 338], outline=(182, 30, 30), width=4)
    draw.text((x2 + cw2 // 2, y2 + 322), "ANSI C · 2ND EDITION", fill=(182, 30, 30), font=load_font(15, True, False), anchor="mm")
    draw.text((x2 + cw2 // 2, y2 + 372), "BRIAN W. KERNIGHAN", fill=(18, 22, 30), font=load_font(14, True, True), anchor="mm")
    draw.text((x2 + cw2 // 2, y2 + 394), "DENNIS M. RITCHIE", fill=(18, 22, 30), font=load_font(14, True, True), anchor="mm")
    draw.text((x2 + cw2 // 2, y2 + 420), "PRENTICE HALL", fill=(48, 54, 66), font=load_font(12, True, False), anchor="mm")

    # ── Spines (horizontal strips at y=460..760, x=0..512) ──
    # Book 0 Spine: Concrete Mathematics
    draw.rectangle([0, 460, 512, 560], fill=(32, 54, 84))
    for rx in [26, 34, 470, 478]:
        draw.rectangle([rx, 460, rx + 4, 560], fill=(222, 198, 134))
    draw.text((256, 498), "CONCRETE MATHEMATICS", fill=(246, 240, 224), font=load_font(21, True, True), anchor="mm")
    draw.text((256, 530), "GRAHAM · KNUTH · PATASHNIK", fill=(222, 206, 162), font=load_font(14, False, True), anchor="mm")

    # Book 1 Spine: SICP
    draw.rectangle([0, 560, 512, 660], fill=(66, 36, 94))
    draw.rectangle([18, 560, 34, 660], fill=(222, 190, 96))
    draw.rectangle([478, 560, 494, 660], fill=(222, 190, 96))
    draw.text((256, 598), "STRUCTURE & INTERP. OF COMPUTER PROGRAMS", fill=(248, 242, 228), font=load_font(14, True, True), anchor="mm")
    draw.text((256, 630), "ABELSON & SUSSMAN  ·  MIT PRESS", fill=(224, 204, 148), font=load_font(13, True, False), anchor="mm")

    # Book 2 Spine: K&R 2e
    draw.rectangle([0, 660, 512, 760], fill=(224, 222, 214))
    draw.rectangle([0, 660, 18, 760], fill=(18, 68, 146))
    draw.rectangle([494, 660, 512, 760], fill=(18, 68, 146))
    draw.rectangle([44, 660, 52, 760], fill=(182, 30, 30))
    draw.text((264, 698), "THE C PROGRAMMING LANGUAGE (2E)", fill=(16, 20, 28), font=load_font(18, True, False), anchor="mm")
    draw.text((264, 730), "KERNIGHAN & RITCHIE  ·  PRENTICE HALL", fill=(26, 44, 82), font=load_font(13, True, False), anchor="mm")

    # ── Lined Cream Page Edges (x=512..1024, y=460..1024) ──
    rng = random.Random(991)
    draw.rectangle([512, 460, 1024, 1024], fill=(238, 230, 212))
    for y in range(460, 1024):
        if (y - 460) % 24 == 0:
            col = (164, 146, 118)
        else:
            v = rng.randint(-14, 10)
            col = (max(0, min(255, 234 + v)), max(0, min(255, 225 + v)), max(0, min(255, 204 + v)))
        draw.line([(512, y), (1024, y)], fill=col)

    # ── Cloth back/rim patches (y=760..1024) ──
    draw.rectangle([0, 760, 170, 1024], fill=(28, 48, 76))
    draw.rectangle([170, 760, 340, 1024], fill=(58, 30, 84))
    draw.rectangle([340, 760, 512, 1024], fill=(238, 240, 244))

    add_paper_grain(img, amount=6, seed=77)
    tex_path = os.path.join(TEX_DIR, "desk_books_atlas.jpg")
    img.save(tex_path, "JPEG", quality=92, optimize=True)
    return tex_path


def px_to_uv(x0, y0, x1, y1, W=1024.0, H=1024.0):
    """Convert PIL pixel rect (top-left origin) to Blender UV rect (bottom-left origin)."""
    return (x0 / W, 1.0 - y1 / H, x1 / W, 1.0 - y0 / H)


def add_quad_uv(bm, uv_layer, verts, uvs):
    f = bm.faces.new(verts)
    for loop, uv in zip(f.loops, uvs):
        loop[uv_layer].uv = uv
    return f


def build_single_book_mesh(name, length_x, width_y, thick_z, hardcover, cover_rect, spine_rect, cloth_rect, mat, loc, rot_z):
    """
    Build one physically accurate book lying flat on XY (bottom at z=0, top at z=thick_z):
      - Spine faces -Y (toward the room/viewer from the desk!)
      - Fore-edge faces +Y (away toward window)
      - Head (top of cover) faces -X (left), foot faces +X (right)
      - Front cover faces +Z (upward toward desk lamp!)
    """
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    hl = length_x * 0.5
    hw = width_y * 0.5
    board_t = 0.0028 if hardcover else 0.0009
    over_x = 0.0038 if hardcover else 0.0004
    over_y = 0.0044 if hardcover else 0.0005
    crown = min(0.0058, thick_z * 0.16) if hardcover else 0.0014

    cu0, cv0, cu1, cv1 = cover_rect
    su0, sv0, su1, sv1 = spine_rect
    bu0, bv0, bu1, bv1 = cloth_rect
    pu0, pv0, pu1, pv1 = px_to_uv(520, 470, 1016, 1016)

    def quad(p0, p1, p2, p3, uvs):
        vs = [bm.verts.new(p) for p in (p0, p1, p2, p3)]
        return add_quad_uv(bm, uv_layer, vs, uvs)

    # 1. Front cover (+Z) — oriented right-side up when viewed from desk front (-Y looking +Y):
    #    spine (-Y) is left or bottom? For natural readability from viewer (-Y):
    #    Let spine be at -X or -Y! Actually on the desk left edge (-1.26, y, -0.80), viewer sits at +Z in Three.js (-Y in Blender!).
    #    Putting spine facing -Y (front of desk) makes spines read cleanly from the room AND front cover reads upright!
    #    Wait: when a closed book lies flat with spine on the LEFT (-X) and front cover UP (+Z), the text reads upright from -Y!
    #    Wait: if spine is on -Y (facing the viewer at desk front), you see the SPINE titles from the office overview AND front covers from above!
    #    Let's orient cover so top of cover is at -X, bottom at +X, spine at -Y -> reads smoothly at desk angle!
    quad(
        (-hl, -hw, thick_z), (hl, -hw, thick_z), (hl, hw, thick_z), (-hl, hw, thick_z),
        [(cu0, cv1), (cu0, cv0), (cu1, cv0), (cu1, cv1)]
    )
    # Back cover (-Z)
    quad(
        (-hl, hw, 0.0), (hl, hw, 0.0), (hl, -hw, 0.0), (-hl, -hw, 0.0),
        [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)]
    )

    # 2. Curved Convex Spine (-Y face, bulging toward -Y with French hinge grooves!)
    segs = 6 if hardcover else 4
    def spine_y_at(t):
        s = t * 2.0 - 1.0
        arch = math.sqrt(max(0.0, 1.0 - s * s * 0.92)) * crown
        groove = -0.0010 * (math.exp(-((t - 0.08) / 0.045) ** 2) + math.exp(-((t - 0.92) / 0.045) ** 2)) if hardcover else 0.0
        return -hw - arch - groove

    for i in range(segs):
        t0 = i / segs
        t1 = (i + 1) / segs
        z0 = thick_z * t0
        z1 = thick_z * t1
        y0 = spine_y_at(t0)
        y1 = spine_y_at(t1)
        v0 = sv0 + (sv1 - sv0) * t0
        v1 = sv0 + (sv1 - sv0) * t1
        f = quad(
            (-hl, y0, z0), (hl, y0, z0), (hl, y1, z1), (-hl, y1, z1),
            [(su0, v0), (su1, v0), (su1, v1), (su0, v1)]
        )
        f.smooth = True

    # Spine end caps (-X and +X)
    for sx, flip in [(-hl, False), (hl, True)]:
        y_in = -hw + board_t
        for i in range(segs):
            t0, t1 = i / segs, (i + 1) / segs
            z0, z1 = thick_z * t0, thick_z * t1
            y0, y1 = spine_y_at(t0), spine_y_at(t1)
            pts = [(sx, y_in, z0), (sx, y0, z0), (sx, y1, z1), (sx, y_in, z1)]
            if flip:
                pts = list(reversed(pts))
            quad(*pts, [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)])

    # 3. Top & Bottom Cover Board Rims + Inner Overhang Lips
    pg_x0, pg_x1 = -hl + over_x, hl - over_x
    pg_y0, pg_y1 = -hw + board_t, hw - over_y
    pg_z0, pg_z1 = board_t, thick_z - board_t

    for z_bot, z_top, is_top in [(0.0, board_t, False), (thick_z - board_t, thick_z, True)]:
        # +Y fore-edge rim
        quad((hl, hw, z_bot), (-hl, hw, z_bot), (-hl, hw, z_top), (hl, hw, z_top), [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)])
        # -X head rim
        quad((-hl, hw, z_bot), (-hl, -hw, z_bot), (-hl, -hw, z_top), (-hl, hw, z_top), [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)])
        # +X foot rim
        quad((hl, -hw, z_bot), (hl, hw, z_bot), (hl, hw, z_top), (hl, -hw, z_top), [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)])
        # Inner underside of overhanging boards (creates real recessed 3D shadow lip around page block!)
        if hardcover:
            zi = z_bot if is_top else z_top
            # Fore-edge inner overhang strip
            pts = [(-hl, pg_y1, zi), (hl, pg_y1, zi), (hl, hw, zi), (-hl, hw, zi)]
            if is_top:
                pts = list(reversed(pts))
            quad(*pts, [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)])
            # Head & foot inner overhang strips
            for sx0, sx1 in [(-hl, pg_x0), (pg_x1, hl)]:
                pts2 = [(sx0, -hw, zi), (sx1, -hw, zi), (sx1, hw, zi), (sx0, hw, zi)]
                if is_top:
                    pts2 = list(reversed(pts2))
                quad(*pts2, [(bu0, bv0), (bu1, bv0), (bu1, bv1), (bu0, bv1)])

    # 4. Recessed Lined Cream Paper Page Block (+Y fore-edge with slight concave curve, -X head, +X foot!)
    # -X head page block
    quad(
        (pg_x0, pg_y1, pg_z0), (pg_x0, pg_y0, pg_z0), (pg_x0, pg_y0, pg_z1), (pg_x0, pg_y1, pg_z1),
        [(pu0, pv0), (pu1, pv0), (pu1, pv1), (pu0, pv1)]
    )
    # +X foot page block
    quad(
        (pg_x1, pg_y0, pg_z0), (pg_x1, pg_y1, pg_z0), (pg_x1, pg_y1, pg_z1), (pg_x1, pg_y0, pg_z1),
        [(pu0, pv0), (pu1, pv0), (pu1, pv1), (pu0, pv1)]
    )
    # +Y fore-edge (3-segment gentle concave arc matching convex spine!)
    f_segs = 3
    f_conc = min(0.0030, thick_z * 0.08) if hardcover else 0.0005
    for i in range(f_segs):
        t0, t1 = i / f_segs, (i + 1) / f_segs
        z0 = pg_z0 + (pg_z1 - pg_z0) * t0
        z1 = pg_z0 + (pg_z1 - pg_z0) * t1
        s0, s1 = t0 * 2.0 - 1.0, t1 * 2.0 - 1.0
        y0 = pg_y1 - math.sqrt(max(0.0, 1.0 - s0 * s0 * 0.92)) * f_conc
        y1 = pg_y1 - math.sqrt(max(0.0, 1.0 - s1 * s1 * 0.92)) * f_conc
        v0 = pv0 + (pv1 - pv0) * t0
        v1 = pv0 + (pv1 - pv0) * t1
        quad(
            (pg_x1, y0, z0), (pg_x0, y0, z0), (pg_x0, y1, z1), (pg_x1, y1, z1),
            [(pu0, v0), (pu1, v0), (pu1, v1), (pu0, v1)]
        )

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)

    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = (0.0, 0.0, rot_z)
    bpy.context.collection.objects.link(obj)
    return obj


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'

    tex_path = paint_book_textures()

    # Single shared PBR material with packed 1024x1024 JPEG atlas -> 1 draw call + tiny GLB!
    mat = bpy.data.materials.new("DeskBooks_Atlas")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.80
    bsdf.inputs["Metallic"].default_value = 0.01

    tex_node = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(tex_path)
    img.pack()
    tex_node.image = img
    nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])

    # Stack 3 realistic books with natural human offset & yaw
    z0 = 0.0
    b0 = build_single_book_mesh(
        "DeskBook_ConcreteMath",
        length_x=0.242, width_y=0.186, thick_z=0.038, hardcover=True,
        cover_rect=px_to_uv(2, 2, 338, 458),
        spine_rect=px_to_uv(2, 462, 510, 558),
        cloth_rect=px_to_uv(10, 770, 160, 1014),
        mat=mat, loc=(0.0, 0.0, z0), rot_z=math.radians(4.0),
    )

    z1 = 0.0382
    b1 = build_single_book_mesh(
        "DeskBook_SICP",
        length_x=0.234, width_y=0.182, thick_z=0.036, hardcover=True,
        cover_rect=px_to_uv(342, 2, 678, 458),
        spine_rect=px_to_uv(2, 562, 510, 658),
        cloth_rect=px_to_uv(180, 770, 330, 1014),
        mat=mat, loc=(0.004, -0.003, z1), rot_z=math.radians(12.5),
    )

    z2 = z1 + 0.0362
    b2 = build_single_book_mesh(
        "DeskBook_KR_C",
        length_x=0.226, width_y=0.172, thick_z=0.019, hardcover=False,
        cover_rect=px_to_uv(682, 2, 1022, 458),
        spine_rect=px_to_uv(2, 662, 510, 758),
        cloth_rect=px_to_uv(350, 770, 502, 1014),
        mat=mat, loc=(-0.006, 0.004, z2), rot_z=math.radians(-6.5),
    )

    # Apply transforms cleanly before export
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Save .blend source of truth
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    # Export clean GLB preserving packed PIL JPEG texture
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_image_format='AUTO',
    )
    print(f"Exported {OUT_GLB} ({os.path.getsize(OUT_GLB) / 1024:.1f} KB)")

    # Render quick Cycles preview PNG to visually verify before shipping!
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.filepath = PREVIEW_PNG

    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.14, 0.12, 0.10, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

    # Studio desk surface + warm key light
    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0, -0.001))
    desk = bpy.context.active_object
    dmat = bpy.data.materials.new("Desk")
    dmat.use_nodes = True
    dmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.18, 0.11, 0.07, 1.0)
    dmat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.65
    desk.data.materials.append(dmat)

    light_data = bpy.data.lights.new("WarmKey", type='AREA')
    light_data.energy = 38.0
    light_data.color = (1.0, 0.90, 0.76)
    light_data.size = 0.55
    light_obj = bpy.data.objects.new("WarmKey", light_data)
    light_obj.location = (0.28, -0.45, 0.52)
    light_obj.rotation_euler = (math.radians(48), 0, math.radians(30))
    scene.collection.objects.link(light_obj)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("Cam", cam_data)
    cam_obj.location = (0.16, -0.42, 0.28)
    direction = Vector((0.0, 0.0, 0.045)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    bpy.ops.render.render(write_still=True)
    print(f"Rendered preview: {PREVIEW_PNG}")


if __name__ == "__main__":
    main()
