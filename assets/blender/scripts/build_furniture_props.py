#!/usr/bin/env python3
"""Build realistic real-world office furniture & desktop props in headless Blender:
1. Herman Miller Aeron Chair (Size B: 654 x 650 x 1040 mm) — iconic curved Pellicle-mesh
   seat pan & hourglass contoured backrest, PostureFit SL lumbar support, sculpted graphite
   frame, cast-aluminum 5-star base with dual-wheel casters, T-armrests with contoured pads.
2. Klipsch R-41M Reference Bookshelf Speaker (146 x 200 x 287 mm) — textured black woodgrain
   cabinet, recessed square 90°x90° Tractrix horn tweeter, recessed 4" spun-copper IMG woofer
   with sculpted concave cone, rubber surround, copper dust cap & corner fasteners.
3. Anglepoise Type 75 Desk Lamp (195 mm stepped circular base, iconic dual-spring articulated
   parallel-bar arms, elbow brackets, spun-aluminum conical shade 145 x 191 mm with top vent
   collar & warm recessed LED bulb).
4. Desktop & Architectural Real-World Props:
   - Ceramic coffee mug with sculpted C-handle + dark espresso + cork coaster (`coffee_mug.blend`)
   - Terracotta planter on mid-century walnut tripod stand with organic sculpted Fiddle-Leaf Fig
     branches & curved veined leaves (`fiddle_fig.blend`)
   - Pleated warm linen curtain drape for framing the panoramic window like felixrieseberg.com
     (`window_curtain.blend`)

Outputs:
  assets/blender/aeron_chair.blend
  assets/blender/klipsch_r41m.blend
  assets/blender/anglepoise_lamp.blend
  assets/blender/coffee_mug.blend
  assets/blender/fiddle_fig.blend
  assets/blender/window_curtain.blend
"""
import math
import os
import random
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Euler
from PIL import Image, ImageDraw, ImageFilter

MM = 0.001
OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def height_to_normal(height_img, strength=4.0):
    h = np.asarray(height_img, dtype=np.float32) / 255.0
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nx, ny, nz = -dx, -dy, np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    rgb = np.stack([
        np.clip((nx / norm * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((ny / norm * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((nz / norm * 0.5 + 0.5) * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)
    return Image.fromarray(rgb, mode="RGB")


def make_pellicle_weave_mat():
    """Generate authentic clearly visible woven charcoal-silver Herman Miller Pellicle mesh!"""
    sz = 256
    # Clearly visible charcoal-silver woven Pellicle mesh (alpha 218 base + 255 bright graphite-silver ribs -> unmistakable in Golden Hour & Twilight!)
    img = Image.new("RGBA", (sz, sz), (62, 68, 80, 214))
    h_img = Image.new("L", (sz, sz), 85)
    d = ImageDraw.Draw(img)
    hd = ImageDraw.Draw(h_img)
    for y in range(0, sz, 5):
        d.line((0, y, sz, y), fill=(116, 124, 138, 255), width=2)
        hd.line((0, y, sz, y), fill=235, width=2)
    for x in range(0, sz, 7):
        d.line((x, 0, x, sz), fill=(86, 92, 106, 240), width=1)
        hd.line((x, 0, x, sz), fill=175, width=1)
    h_img = h_img.filter(ImageFilter.GaussianBlur(radius=0.6))
    n_img = height_to_normal(h_img, strength=3.6)
    p = os.path.join(TEX_DIR, "aeron_pellicle_weave.png")
    pn = os.path.join(TEX_DIR, "aeron_pellicle_normal.png")
    img.save(p)
    n_img.save(pn)

    mat = bpy.data.materials.new("Aeron_PellicleMesh")
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = 0.20
    bsdf.inputs["Roughness"].default_value = 0.42
    tex = nt.nodes.new("ShaderNodeTexImage")
    im = bpy.data.images.load(p)
    im.pack()
    tex.image = im
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])

    tex_n = nt.nodes.new("ShaderNodeTexImage")
    im_n = bpy.data.images.load(pn)
    im_n.colorspace_settings.name = "Non-Color"
    im_n.pack()
    tex_n.image = im_n
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 1.0
    nt.links.new(tex_n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def make_linen_curtain_mat():
    """Generate a soft, organic heavyweight woven warm linen texture (ZERO horizontal moire striping!)."""
    rng = random.Random(77)
    sz = 512
    # Smooth organic woven slub noise (multi-scale soft fibers -> zero aliasing stripes at any distance!)
    base = np.zeros((sz, sz, 3), dtype=np.float32)
    base[:, :, 0] = 206.0
    base[:, :, 1] = 184.0
    base[:, :, 2] = 154.0
    # Subtle soft vertical & horizontal linen slub variation
    np_rng = np.random.default_rng(77)
    v_slub = np_rng.normal(0, 4.5, (1, sz, 1))
    h_slub = np_rng.normal(0, 3.2, (sz, 1, 1))
    grain = np_rng.normal(0, 5.5, (sz, sz, 1))
    rgb = np.clip(base + v_slub + h_slub + grain, 0, 255).astype(np.uint8)
    img = Image.fromarray(rgb, mode="RGB").filter(ImageFilter.GaussianBlur(radius=0.8))
    h_arr = np.clip(128.0 + (v_slub[:, :, 0] * 4.0 + h_slub[:, :, 0] * 3.0 + grain[:, :, 0] * 3.0), 0, 255).astype(np.uint8)
    h_img = Image.fromarray(h_arr, mode="L").filter(ImageFilter.GaussianBlur(radius=1.0))
    n_img = height_to_normal(h_img, strength=2.6)
    p = os.path.join(TEX_DIR, "curtain_linen.png")
    pn = os.path.join(TEX_DIR, "curtain_linen_normal.png")
    img.save(p)
    n_img.save(pn)

    mat = bpy.data.materials.new("Curtain_WarmLinen")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.92
    tex = nt.nodes.new("ShaderNodeTexImage")
    im = bpy.data.images.load(p)
    im.pack()
    tex.image = im
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    tex_n = nt.nodes.new("ShaderNodeTexImage")
    im_n = bpy.data.images.load(pn)
    im_n.colorspace_settings.name = "Non-Color"
    im_n.pack()
    tex_n.image = im_n
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.95
    nt.links.new(tex_n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def make_fiddle_leaf_mat(name, base_rgb, vein_rgb):
    """Organic Fiddle-Leaf Fig leaf texture with realistic midrib, lateral veins & satin botanical variation."""
    w, h = 256, 384
    img = Image.new("RGB", (w, h), base_rgb)
    h_img = Image.new("L", (w, h), 128)
    d = ImageDraw.Draw(img)
    hd = ImageDraw.Draw(h_img)
    # Central pale-green midrib
    d.line((w // 2, h, w // 2, 16), fill=vein_rgb, width=6)
    hd.line((w // 2, h, w // 2, 16), fill=225, width=6)
    # Curved lateral botanical veins
    for vy in range(48, h - 32, 36):
        for sx in (-1, 1):
            pts = [(w // 2, vy), (w // 2 + sx * 52, vy - 18), (w // 2 + sx * 116, vy - 46)]
            d.line(pts, fill=vein_rgb, width=3)
            hd.line(pts, fill=195, width=3)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    h_img = h_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    n_img = height_to_normal(h_img, strength=3.5)
    p = os.path.join(TEX_DIR, f"{name}.png")
    pn = os.path.join(TEX_DIR, f"{name}_nrm.png")
    img.save(p)
    n_img.save(pn)

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.62
    bsdf.inputs["Clearcoat"].default_value = 0.04
    tex = nt.nodes.new("ShaderNodeTexImage")
    im = bpy.data.images.load(p)
    im.pack()
    tex.image = im
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    tex_n = nt.nodes.new("ShaderNodeTexImage")
    im_n = bpy.data.images.load(pn)
    im_n.colorspace_settings.name = "Non-Color"
    im_n.pack()
    tex_n.image = im_n
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.85
    nt.links.new(tex_n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def make_mat(name, color, metallic=0.1, roughness=0.45, coat=0.0, emit=None, emit_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Clearcoat"].default_value = coat
    if emit is not None:
        bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=2, rot=(0, 0, 0)):
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
    return obj


def add_cyl(name, r1, r2, depth, loc, rot, mat, verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_tube(name, pts, radius, mat, closed=False, res=6):
    cdata = bpy.data.curves.new(name, type="CURVE")
    cdata.dimensions = "3D"
    cdata.bevel_depth = radius
    cdata.bevel_resolution = res
    sp = cdata.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    sp.use_cyclic_u = closed
    sp.type = "NURBS"
    if not closed:
        sp.use_endpoint_u = True
    obj = bpy.data.objects.new(name, cdata)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return bpy.context.active_object


def build_aeron_chair():
    """Herman Miller Aeron (Size B): 654 mm W x 650 mm D x 1040 mm H, facing -Y (front toward desk)."""
    clear_scene()
    graphite = make_mat("Aeron_GraphiteFrame", (0.10, 0.108, 0.122), metallic=0.38, roughness=0.40)
    alu_base = make_mat("Aeron_CastAluBase", (0.36, 0.38, 0.42), metallic=0.82, roughness=0.30)
    chrome = make_mat("Aeron_GasPiston", (0.82, 0.84, 0.88), metallic=0.96, roughness=0.14)
    # Authentic semi-transparent woven charcoal Pellicle mesh (you clearly see light & room through the weave!)
    pellicle = make_pellicle_weave_mat()
    arm_pad = make_mat("Aeron_ArmPad", (0.085, 0.090, 0.100), metallic=0.0, roughness=0.65)
    caster_rubber = make_mat("Aeron_Caster", (0.04, 0.042, 0.048), metallic=0.0, roughness=0.82)

    # 1. 5-star tapered die-cast aluminum base + dual-wheel casters (radius 315mm)
    add_cyl("Base_Hub", 38 * MM, 34 * MM, 70 * MM, (0, 0, 108 * MM), (0, 0, 0), alu_base, 24)
    for i in range(5):
        a = (i / 5.0) * math.pi * 2.0 + math.pi / 10.0
        dx, dy = math.sin(a), math.cos(a)
        pts = [
            (dx * 28 * MM, dy * 28 * MM, 118 * MM),
            (dx * 165 * MM, dy * 165 * MM, 92 * MM),
            (dx * 305 * MM, dy * 305 * MM, 68 * MM),
        ]
        add_tube(f"Base_Spoke_{i}", pts, 14 * MM, alu_base, res=4)
        # Dual wheel caster
        cx, cy = dx * 305 * MM, dy * 305 * MM
        add_cyl(f"Caster_Stem_{i}", 8 * MM, 8 * MM, 28 * MM, (cx, cy, 52 * MM), (0, 0, 0), graphite, 12)
        for side in (-14 * MM, 14 * MM):
            wx = cx + math.cos(a) * side
            wy = cy - math.sin(a) * side
            add_cyl(f"Caster_Wheel_{i}_{side:.2f}", 28 * MM, 28 * MM, 12 * MM, (wx, wy, 28 * MM), (0, math.pi / 2, -a), caster_rubber, 18)

    # Pneumatic gas cylinder + Herman Miller tilt mechanism housing
    add_cyl("Gas_CylinderOuter", 26 * MM, 24 * MM, 195 * MM, (0, 0, 215 * MM), (0, 0, 0), graphite, 20)
    add_cyl("Gas_Piston", 16 * MM, 16 * MM, 130 * MM, (0, 0, 355 * MM), (0, 0, 0), chrome, 18)
    add_box("Tilt_Mechanism", (168 * MM, 210 * MM, 92 * MM), (0, 15 * MM, 395 * MM), graphite, bevel=14 * MM, segments=3)

    # 2. Contoured Aeron Seat Frame (organic curved closed loop tube) + Suspended Pellicle Mesh Pan
    seat_pts = []
    n_seat = 24
    for i in range(n_seat):
        t = (i / n_seat) * math.pi * 2.0
        # Rounded ergonomic trapezoid seat profile: wider in middle/front, gentle waterfall drop at front (-Y)
        sx = math.sin(t) * (252 * MM) * (1.0 - 0.08 * math.cos(t))
        sy = math.cos(t) * (222 * MM)
        # Subtle ergonomic saddle dip in center + front waterfall drop
        sz = 468 * MM - 18 * MM * max(0.0, -math.cos(t)) ** 1.5 + 14 * MM * (math.sin(t) ** 2)
        seat_pts.append((sx, sy, sz))
    add_tube("Seat_OuterFrame", seat_pts, 12.5 * MM, graphite, closed=True, res=6)

    # Suspended curved Pellicle mesh seat pan
    bm = bmesh.new()
    uv_s = bm.loops.layers.uv.new("UVMap")
    gx, gy = 14, 14
    verts = []
    for iy in range(gy + 1):
        row = []
        v = (iy / gy) * 2.0 - 1.0  # -1 front .. +1 rear
        for ix in range(gx + 1):
            u = (ix / gx) * 2.0 - 1.0
            r = math.sqrt(u * u + v * v)
            if r > 1.0:
                u2, v2 = u / r, v / r
            else:
                u2, v2 = u, v
            x = u2 * 244 * MM * (1.0 - 0.06 * v2)
            y = v2 * 214 * MM
            z = 466 * MM - 16 * MM * (1.0 - u2 * u2) * (1.0 - v2 * v2) - 14 * MM * max(0.0, -v2) ** 1.8
            row.append(bm.verts.new((x, y, z)))
        verts.append(row)
    for iy in range(gy):
        for ix in range(gx):
            f = bm.faces.new((verts[iy][ix], verts[iy][ix + 1], verts[iy + 1][ix + 1], verts[iy + 1][ix]))
            f.smooth = True
            for lp in f.loops:
                lp[uv_s].uv = (lp.vert.co.x * 10.0, lp.vert.co.y * 10.0)
    me = bpy.data.meshes.new("Seat_PellicleMesh")
    bm.to_mesh(me)
    bm.free()
    seat_mesh = bpy.data.objects.new("Seat_Pellicle", me)
    bpy.context.scene.collection.objects.link(seat_mesh)
    seat_mesh.data.materials.append(pellicle)

    # Seat-to-tilt side mounting brackets (visually anchors seat hoop solidly to tilt mechanism — ZERO floating hoop!)
    for side in (-1, 1):
        add_box(f"Seat_SideBracket_{side}", (18 * MM, 118 * MM, 56 * MM), (side * 124 * MM, 14 * MM, 434 * MM), graphite, bevel=4 * MM, rot=(0, side * 0.24, 0))
    add_box("Seat_FrontCrossBar", (286 * MM, 28 * MM, 24 * MM), (0, -68 * MM, 434 * MM), graphite, bevel=5 * MM)

    # 3. Sculpted Flattened Aeron Y-Tower Spine + Contoured Hourglass Backrest Frame + Pellicle Mesh + Sculpted PostureFit SL
    spine_pts = [
        (0, 75 * MM, 385 * MM),
        (0, 228 * MM, 442 * MM),
        (0, 260 * MM, 565 * MM),
        (0, 280 * MM, 695 * MM),
    ]
    spine_obj = add_tube("Back_Spine", spine_pts, 13.0 * MM, alu_base, res=6)
    spine_obj.scale = (1.35, 0.72, 1.0)
    bpy.context.view_layer.objects.active = spine_obj
    bpy.ops.object.transform_apply(scale=True)
    # Sculpted Y-fork arms tapering gracefully into the backrest side frame
    for side in (-1, 1):
        fork_pts = [
            (0, 272 * MM, 668 * MM),
            (side * 128 * MM, 258 * MM, 712 * MM),
            (side * 224 * MM, 230 * MM, 742 * MM),
        ]
        fk = add_tube(f"Back_YFork_{side}", fork_pts, 9.2 * MM, alu_base, res=5)
        fk.scale = (1.0, 0.72, 1.15)
        bpy.context.view_layer.objects.active = fk
        bpy.ops.object.transform_apply(scale=True)

    # Iconic Herman Miller Aeron contoured broad-shoulder trapezoid backrest (Z from 525 mm to 1015 mm)
    back_pts = []
    n_back = 32
    for i in range(n_back):
        t = (i / n_back) * math.pi * 2.0
        st, ct = math.sin(t), math.cos(t)
        # Squircle-trapezoid Aeron backrest: squared broad shoulders at top, sculpted lumbar taper at waist!
        sq_x = math.copysign(abs(st) ** 0.72, st)
        sq_z = math.copysign(abs(ct) ** 0.76, ct)
        width_profile = 248 * MM * (0.82 + 0.18 * (sq_z * 0.5 + 0.5) - 0.06 * math.exp(-((sq_z + 0.35) / 0.3) ** 2))
        bx = sq_x * width_profile
        bz = 770 * MM + sq_z * 242 * MM
        by = 238 * MM + sq_z * 38 * MM - 24 * MM * math.exp(-((sq_z + 0.25) / 0.45) ** 2) - 20 * MM * (sq_x * sq_x)
        back_pts.append((bx, by, bz))
    add_tube("Back_OuterFrame", back_pts, 11.5 * MM, graphite, closed=True, res=6)

    # Backrest translucent Pellicle mesh surface with UVs (single thin layer rendered DoubleSide in Three.js!)
    bm_b = bmesh.new()
    uv_b = bm_b.loops.layers.uv.new("UVMap")
    bverts = []
    for iz in range(15):
        row = []
        v = (iz / 14.0) * 2.0 - 1.0
        sq_z = math.copysign(abs(v) ** 0.76, v)
        w_prof = 240 * MM * (0.82 + 0.18 * (sq_z * 0.5 + 0.5) - 0.06 * math.exp(-((sq_z + 0.35) / 0.3) ** 2))
        for ix in range(15):
            u = (ix / 14.0) * 2.0 - 1.0
            r = math.sqrt(u * u + v * v)
            u2, v2 = (u / r, v / r) if r > 1.0 else (u, v)
            sq_u = math.copysign(abs(u2) ** 0.72, u2)
            sq_v = math.copysign(abs(v2) ** 0.76, v2)
            x = sq_u * w_prof
            z = 770 * MM + sq_v * 234 * MM
            y = 240 * MM + sq_v * 38 * MM - 24 * MM * math.exp(-((sq_v + 0.25) / 0.45) ** 2) - 18 * MM * (sq_u * sq_u)
            row.append(bm_b.verts.new((x, y, z)))
        bverts.append(row)
    for iz in range(14):
        for ix in range(14):
            f = bm_b.faces.new((bverts[iz][ix], bverts[iz][ix + 1], bverts[iz + 1][ix + 1], bverts[iz + 1][ix]))
            f.smooth = True
            for lp in f.loops:
                lp[uv_b].uv = (lp.vert.co.x * 10.0, lp.vert.co.z * 10.0)
    bme = bpy.data.meshes.new("Back_PellicleMesh")
    bm_b.to_mesh(bme)
    bm_b.free()
    back_mesh = bpy.data.objects.new("Back_Pellicle", bme)
    bpy.context.scene.collection.objects.link(back_mesh)
    back_mesh.data.materials.append(pellicle)

    # Sculpted contoured PostureFit SL dual butterfly lumbar pads on rear of backrest (organic softly rounded wings!)
    for side in (-1, 1):
        add_box(f"PostureFit_Pad_{side}", (72 * MM, 12 * MM, 104 * MM), (side * 54 * MM, 240 * MM, 646 * MM), graphite, bevel=10 * MM, segments=4, rot=(0.06, side * 0.08, side * 0.22))
    add_cyl("PostureFit_Knob", 14 * MM, 18 * MM, (0, 272 * MM, 646 * MM), (math.pi / 2, 0, 0), graphite, 20)

    # 4. Sleek Real-Aeron Vertical T-Armrests (sculpted vertical stalks + contoured softly rounded elastomer arm pads!)
    for side in (-1, 1):
        arm_pts = [
            (0, 250 * MM, 548 * MM),
            (side * 238 * MM, 232 * MM, 548 * MM),
            (side * 268 * MM, 165 * MM, 564 * MM),
            (side * 272 * MM, 44 * MM, 650 * MM),
        ]
        add_tube(f"Arm_Stalk_{side}", arm_pts, 9.2 * MM, graphite, res=5)
        add_box(f"Arm_Pad_{side}", (78 * MM, 232 * MM, 22 * MM), (side * 272 * MM, 6 * MM, 668 * MM), arm_pad, bevel=10.5 * MM, segments=4)

    out_blend = os.path.join(OUT_DIR, "aeron_chair.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_klipsch_r41m():
    """Klipsch R-41M Reference Bookshelf Speaker: 146 x 200 x 287 mm, Tractrix horn + 4" spun-copper woofer."""
    clear_scene()
    W = 146.0 * MM
    D = 200.0 * MM
    H = 287.0 * MM

    cabinet_black = make_mat("Klipsch_BlackVinyl", (0.048, 0.050, 0.056), metallic=0.05, roughness=0.62)
    horn_matte = make_mat("Klipsch_TractrixMatte", (0.028, 0.030, 0.035), metallic=0.12, roughness=0.52)
    copper_cone = make_mat("Klipsch_SpunCopper", (0.76, 0.42, 0.19), metallic=0.88, roughness=0.22)
    surround_rubber = make_mat("Klipsch_RubberSurround", (0.025, 0.027, 0.030), metallic=0.0, roughness=0.78)
    screw_steel = make_mat("Klipsch_Fastener", (0.55, 0.58, 0.62), metallic=0.92, roughness=0.28)
    gold_badge = make_mat("Klipsch_CopperBadge", (0.82, 0.54, 0.28), metallic=0.90, roughness=0.24)

    # Main textured black cabinet (front facing -Y)
    add_box("Klipsch_Cabinet", (W, D, H), (0, 0, H * 0.5), cabinet_black, bevel=2.5 * MM, segments=2)

    fy = -D * 0.5
    # 1. Iconic Square 90°x90° Tractrix Horn Tweeter (upper section, z = 208mm)
    add_box("Tractrix_OuterFrame", (102 * MM, 5 * MM, 102 * MM), (0, fy - 1.5 * MM, 208 * MM), horn_matte, bevel=2 * MM)
    # Stepped Tractrix waveguide rings proud of front plate so horn depth reads crisply!
    add_box("Tractrix_Step1", (78 * MM, 4 * MM, 78 * MM), (0, fy - 3.6 * MM, 208 * MM), surround_rubber, bevel=4 * MM)
    add_cyl("Tractrix_Throat", 24 * MM, 15 * MM, 4 * MM, (0, fy - 5.2 * MM, 208 * MM), (math.pi / 2, 0, 0), horn_matte, 24)
    # 1" Aluminum LTS tweeter dome inside horn throat
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=12 * MM, location=(0, fy - 5.8 * MM, 208 * MM))
    dome = bpy.context.active_object
    dome.name = "Tractrix_TweeterDome"
    dome.scale = (1.0, 0.42, 1.0)
    dome.data.materials.append(screw_steel)

    # 2. Iconic 4" (102mm) Spun-Copper IMG Woofer (lower section, z = 98mm)
    wz = 98 * MM
    # Trim ring + rolled rubber surround
    bpy.ops.mesh.primitive_torus_add(major_radius=53 * MM, minor_radius=5.5 * MM, major_segments=32, minor_segments=12, location=(0, fy - 2.0 * MM, wz), rotation=(math.pi / 2, 0, 0))
    trim = bpy.context.active_object
    trim.name = "Woofer_TrimRing"
    trim.data.materials.append(horn_matte)

    bpy.ops.mesh.primitive_torus_add(major_radius=46 * MM, minor_radius=5.0 * MM, major_segments=32, minor_segments=12, location=(0, fy - 3.4 * MM, wz), rotation=(math.pi / 2, 0, 0))
    surr = bpy.context.active_object
    surr.name = "Woofer_Surround"
    surr.data.materials.append(surround_rubber)

    # Full 4" Spun-Copper IMG cone proud enough to show full copper cone surface cleanly!
    add_cyl("Woofer_CopperCone", 44 * MM, 18 * MM, 11 * MM, (0, fy - 2.2 * MM, wz), (-math.pi / 2, 0, 0), copper_cone, 32)
    # Convex spun-copper dust cap in center
    bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=12, radius=18 * MM, location=(0, fy - 6.8 * MM, wz))
    cap = bpy.context.active_object
    cap.name = "Woofer_DustCap"
    cap.scale = (1.0, 0.36, 1.0)
    cap.data.materials.append(copper_cone)

    # 4 exposed corner fasteners around woofer & horn (signature Klipsch Reference look!)
    for cz in (wz, 208 * MM):
        rad = 55 * MM if cz == wz else 46 * MM
        for k in range(4):
            a = k * math.pi / 2.0 + math.pi / 4.0
            add_cyl(f"Fastener_{cz:.2f}_{k}", 2.6 * MM, 2.6 * MM, 2.5 * MM, (math.cos(a) * rad, fy - 3.6 * MM, cz + math.sin(a) * rad), (math.pi / 2, 0, 0), screw_steel, 10)

    # Bottom subtle copper Klipsch badge bar
    add_box("Klipsch_FrontBadge", (32 * MM, 2.5 * MM, 6.5 * MM), (0, fy - 1.0 * MM, 22 * MM), gold_badge, bevel=0.6 * MM)

    out_blend = os.path.join(OUT_DIR, "klipsch_r41m.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_anglepoise_lamp():
    """Anglepoise Type 75 Desk Lamp (195mm stepped base, parallel articulated arms, 145x191mm shade)."""
    clear_scene()
    matte_black = make_mat("Lamp_JetBlack", (0.042, 0.045, 0.052), metallic=0.32, roughness=0.44)
    # Rich antique brushed brass (calibrated so arms NEVER blow out bright yellow-white in Twilight!)
    brushed_brass = make_mat("Lamp_BrushedBrass", (0.54, 0.39, 0.19), metallic=0.86, roughness=0.32)
    chrome_spring = make_mat("Lamp_Chrome", (0.64, 0.67, 0.72), metallic=0.90, roughness=0.24)
    shade_inner = make_mat("Lamp_ShadeInnerWhite", (0.94, 0.90, 0.82), metallic=0.0, roughness=0.35)
    bulb_emit = make_mat("Lamp_WarmBulb", (1.0, 0.92, 0.78), metallic=0.0, roughness=0.2, emit=(1.0, 0.82, 0.52), emit_strength=8.0)

    # 1. Stepped circular cast-iron weighted base (195mm dia, 28mm tall)
    add_cyl("Base_Lower", 97.5 * MM, 95 * MM, 18 * MM, (0, 0, 9 * MM), (0, 0, 0), matte_black, 36)
    add_cyl("Base_UpperStep", 86 * MM, 78 * MM, 12 * MM, (0, 0, 22 * MM), (0, 0, 0), matte_black, 36)
    add_cyl("Base_StemBoss", 18 * MM, 16 * MM, 38 * MM, (0, 0, 44 * MM), (0, 0, 0), brushed_brass, 20)

    # 2. Iconic Anglepoise Dual Parallel Lower Arms + Distinct Ribbed Chrome Tension Springs
    # Pronounced articulated < elbow silhouette so it reads unmistakably as an Anglepoise Type 75!
    p_bot = Vector((0, 0, 58 * MM))
    p_mid = Vector((0, 116 * MM, 316 * MM))
    p_top = Vector((0, -132 * MM, 480 * MM))

    for sx in (-14 * MM, 14 * MM):
        add_tube(f"LowerArm_{sx:.3f}", [(sx, p_bot.y, p_bot.z), (sx, p_mid.y, p_mid.z)], 6.0 * MM, brushed_brass, res=5)
        # Signature Anglepoise coiled chrome tension spring alongside lower arm
        sp0 = Vector((sx * 1.48, p_bot.y - 18 * MM, p_bot.z + 18 * MM))
        sp1 = Vector((sx * 1.48, p_mid.y * 0.56 - 14 * MM, p_bot.z + 162 * MM))
        add_tube(f"Spring_{sx:.3f}", [sp0, sp1], 8.2 * MM, chrome_spring, res=6)
        for ci in range(7):
            ft = 0.14 + ci * 0.11
            cp = sp0.lerp(sp1, ft)
            bpy.ops.mesh.primitive_torus_add(major_radius=8.5 * MM, minor_radius=2.0 * MM, major_segments=14, minor_segments=6, location=cp, rotation=(0.35, 0, 0))
            coil = bpy.context.active_object
            coil.name = f"SpringCoil_{sx:.3f}_{ci}"
            coil.data.materials.append(chrome_spring)

    # Elbow machined joint + dual upper parallel linkages
    add_cyl("Elbow_Joint", 16 * MM, 16 * MM, 40 * MM, p_mid, (0, math.pi / 2, 0), matte_black, 20)
    add_cyl("Elbow_Cap", 11 * MM, 11 * MM, 46 * MM, p_mid, (0, math.pi / 2, 0), chrome_spring, 18)

    for sx in (-8 * MM, 8 * MM):
        add_tube(f"UpperArm_{sx:.3f}", [(sx, p_mid.y, p_mid.z), (sx, p_top.y, p_top.z)], 5.2 * MM, brushed_brass, res=5)
    add_cyl("Wrist_Joint", 12 * MM, 12 * MM, 28 * MM, p_top, (0, math.pi / 2, 0), brushed_brass, 18)

    # 3. Iconic Anglepoise Type 75 Spun-Aluminum Conical Shade (145mm dia x 191mm height)
    shade_tilt = (math.radians(24), 0, 0)
    shade_dir = Euler(shade_tilt).to_matrix() @ Vector((0, 0, -1))
    shade_center = p_top + shade_dir * 72 * MM

    # Top cylindrical vent cap
    cap_pos = p_top + shade_dir * (-16 * MM)
    add_cyl("Shade_TopCap", 30 * MM, 24 * MM, 46 * MM, cap_pos, shade_tilt, matte_black, 28)
    # Brass finial collar ring
    add_cyl("Shade_BrassCollar", 32 * MM, 32 * MM, 8 * MM, p_top + shade_dir * 6 * MM, shade_tilt, brushed_brass, 28)
    # Main conical shade shell (hollow via Solidify!)
    bpy.ops.mesh.primitive_cone_add(vertices=36, radius1=72.5 * MM, radius2=31 * MM, depth=142 * MM, end_fill_type="NOTHING", location=shade_center, rotation=shade_tilt)
    shade = bpy.context.active_object
    shade.name = "Shade_Cone"
    shade.data.materials.append(matte_black)
    shade.data.materials.append(shade_inner)
    sol = shade.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 2.5 * MM
    sol.material_offset = 1
    bpy.ops.object.modifier_apply(modifier=sol.name)
    for p in shade.data.polygons:
        p.use_smooth = True

    # Warm glowing bulb tucked inside shade
    bulb_pos = p_top + shade_dir * 66 * MM
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=27 * MM, location=bulb_pos)
    bulb = bpy.context.active_object
    bulb.name = "Lamp_Bulb"
    bulb.data.materials.append(bulb_emit)
    for p in bulb.data.polygons:
        p.use_smooth = True

    out_blend = os.path.join(OUT_DIR, "anglepoise_lamp.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_coffee_mug():
    """Glazed ceramic stoneware coffee mug (84mm dia x 96mm H) with sculpted handle + cork coaster."""
    clear_scene()
    ceramic = make_mat("Mug_StonewareCream", (0.86, 0.82, 0.76), metallic=0.0, roughness=0.22, coat=0.55)
    clay_foot = make_mat("Mug_RawClay", (0.64, 0.54, 0.44), metallic=0.0, roughness=0.82)
    coffee = make_mat("Mug_Espresso", (0.06, 0.025, 0.012), metallic=0.0, roughness=0.06, coat=0.95)
    cork = make_mat("Coaster_Cork", (0.56, 0.40, 0.25), metallic=0.0, roughness=0.90)

    # Cork coaster (100mm dia x 6mm thick)
    add_cyl("Coaster", 50 * MM, 49 * MM, 6 * MM, (0, 0, 3 * MM), (0, 0, 0), cork, 32)
    z0 = 6 * MM

    # Raw clay foot ring
    add_cyl("Mug_Foot", 37 * MM, 39 * MM, 12 * MM, (0, 0, z0 + 6 * MM), (0, 0, 0), clay_foot, 32)

    # Hollow glazed ceramic mug body
    bpy.ops.mesh.primitive_cone_add(vertices=36, radius1=39 * MM, radius2=42 * MM, depth=86 * MM, end_fill_type="NOTHING", location=(0, 0, z0 + 53 * MM))
    body = bpy.context.active_object
    body.name = "Mug_Body"
    body.data.materials.append(ceramic)
    sol = body.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 4.5 * MM
    bpy.ops.object.modifier_apply(modifier=sol.name)
    for p in body.data.polygons:
        p.use_smooth = True

    # Sculpted C-handle
    handle_pts = [
        (39 * MM, 0, z0 + 76 * MM),
        (65 * MM, 0, z0 + 74 * MM),
        (68 * MM, 0, z0 + 50 * MM),
        (62 * MM, 0, z0 + 28 * MM),
        (38 * MM, 0, z0 + 26 * MM),
    ]
    add_tube("Mug_Handle", handle_pts, 6.2 * MM, ceramic, res=6)

    # Glossy dark coffee meniscus inside mug
    add_cyl("Mug_Coffee", 36.5 * MM, 36.5 * MM, 4 * MM, (0, 0, z0 + 82 * MM), (0, 0, 0), coffee, 28)

    out_blend = os.path.join(OUT_DIR, "coffee_mug.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_fiddle_fig():
    """Organic Fiddle-Leaf Fig in ceramic/terracotta planter on mid-century walnut stand (height ~1.55m)."""
    clear_scene()
    terracotta = make_mat("Planter_Terracotta", (0.68, 0.37, 0.25), metallic=0.0, roughness=0.72)
    walnut = make_mat("Stand_Walnut", (0.28, 0.16, 0.085), metallic=0.0, roughness=0.45, coat=0.2)
    soil = make_mat("Planter_Soil", (0.09, 0.065, 0.045), metallic=0.0, roughness=0.96)
    bark = make_mat("Fig_Bark", (0.22, 0.15, 0.095), metallic=0.0, roughness=0.88)
    leaf_dark = make_fiddle_leaf_mat("Fig_LeafDark", (26, 62, 28), (62, 104, 48))
    leaf_mid = make_fiddle_leaf_mat("Fig_LeafMid", (36, 78, 34), (78, 122, 56))

    # 1. Mid-century walnut crossed plant stand
    for i in range(4):
        a = i * math.pi / 2.0 + math.pi / 4.0
        add_cyl(f"Stand_Leg_{i}", 15 * MM, 17 * MM, 380 * MM, (math.cos(a) * 192 * MM, math.sin(a) * 192 * MM, 190 * MM), (0, 0, 0), walnut, 12)
    add_box("Stand_Cross1", (384 * MM, 28 * MM, 28 * MM), (0, 0, 125 * MM), walnut, bevel=3 * MM, rot=(0, 0, math.pi / 4))
    add_box("Stand_Cross2", (384 * MM, 28 * MM, 28 * MM), (0, 0, 125 * MM), walnut, bevel=3 * MM, rot=(0, 0, -math.pi / 4))

    # 2. Terracotta planter pot with thick rolled rim
    add_cyl("Planter_Body", 155 * MM, 195 * MM, 310 * MM, (0, 0, 290 * MM), (0, 0, 0), terracotta, 32)
    bpy.ops.mesh.primitive_torus_add(major_radius=194 * MM, minor_radius=16 * MM, major_segments=32, minor_segments=12, location=(0, 0, 442 * MM))
    rim = bpy.context.active_object
    rim.name = "Planter_Rim"
    rim.data.materials.append(terracotta)
    add_cyl("Planter_Soil", 184 * MM, 184 * MM, 24 * MM, (0, 0, 428 * MM), (0, 0, 0), soil, 24)

    # 3. Sculpted branching wooden trunks
    trunk1 = [(0, 0, 425 * MM), (28 * MM, -18 * MM, 740 * MM), (-16 * MM, 24 * MM, 1080 * MM), (22 * MM, 10 * MM, 1420 * MM)]
    trunk2 = [(14 * MM, -10 * MM, 640 * MM), (-75 * MM, -55 * MM, 940 * MM), (-110 * MM, -65 * MM, 1220 * MM)]
    trunk3 = [(-10 * MM, 18 * MM, 820 * MM), (95 * MM, 48 * MM, 1090 * MM), (132 * MM, 68 * MM, 1340 * MM)]
    add_tube("Fig_TrunkMain", trunk1, 18 * MM, bark, res=5)
    add_tube("Fig_BranchL", trunk2, 11 * MM, bark, res=4)
    add_tube("Fig_BranchR", trunk3, 10 * MM, bark, res=4)

    # 4. Sculpted Organic Curved Violin-Shaped Fiddle-Leaf Fig Leaves (batched into one clean mesh!)
    rng = random.Random(404)
    bm = bmesh.new()
    uv_fig = bm.loops.layers.uv.new("UVMap")

    def add_fig_leaf(origin, yaw, pitch, roll, scale, mat_idx):
        rot_m = Euler((pitch, roll, yaw), "XYZ").to_matrix().to_4x4()
        trans = Matrix.Translation(origin) @ rot_m
        rows_v = []
        v_steps = [0.0, 0.22, 0.45, 0.72, 0.92, 1.0]
        w_steps = [0.06, 0.36, 0.30, 0.56, 0.42, 0.04]
        droop_steps = [0.0, 0.04, 0.05, 0.01, -0.06, -0.10]
        for iv, (vf, wf, df) in enumerate(zip(v_steps, w_steps, droop_steps)):
            row = []
            for iu, uf in enumerate([-1.0, -0.45, 0.0, 0.45, 1.0]):
                x = uf * wf * 0.24 * scale
                y = vf * 0.30 * scale
                crease = abs(uf) * 0.024 * scale
                wave = math.sin(vf * 9.0 + uf * 2.0) * 0.008 * scale * abs(uf)
                z = (df * 0.24 * scale) + crease + wave
                row.append((bm.verts.new(trans @ Vector((x, y, z))), (uf + 1.0) * 0.5, vf))
            rows_v.append(row)
        for iv in range(len(rows_v) - 1):
            for iu in range(4):
                v00, u00, t00 = rows_v[iv][iu]
                v10, u10, t10 = rows_v[iv][iu + 1]
                v11, u11, t11 = rows_v[iv + 1][iu + 1]
                v01, u01, t01 = rows_v[iv + 1][iu]
                f = bm.faces.new((v00, v10, v11, v01))
                f.material_index = mat_idx
                f.smooth = True
                for lp, uv in zip(f.loops, [(u00, t00), (u10, t10), (u11, t11), (u01, t01)]):
                    lp[uv_fig].uv = uv

    # Place 34 lush leaves along all three branches
    anchors = [
        (trunk1, 18),
        (trunk2, 8),
        (trunk3, 8),
    ]
    l_idx = 0
    for pts, count in anchors:
        for i in range(count):
            t = 0.28 + (i / max(1, count - 1)) * 0.72
            # Linear interpolate along polyline
            seg = t * (len(pts) - 1)
            idx0 = min(int(seg), len(pts) - 2)
            frac = seg - idx0
            p0, p1 = Vector(pts[idx0]), Vector(pts[idx0 + 1])
            pos = p0.lerp(p1, frac)
            yaw = l_idx * 2.39996 + rng.uniform(-0.25, 0.25)
            pitch = rng.uniform(-0.35, 0.32)
            roll = rng.uniform(-0.28, 0.28)
            sc = rng.uniform(0.82, 1.28)
            add_fig_leaf(pos, yaw, pitch, roll, sc, l_idx % 2)
            l_idx += 1

    me = bpy.data.meshes.new("Fig_LeavesMesh")
    bm.to_mesh(me)
    bm.free()
    leaves_obj = bpy.data.objects.new("Fig_Leaves", me)
    bpy.context.scene.collection.objects.link(leaves_obj)
    leaves_obj.data.materials.append(leaf_dark)
    leaves_obj.data.materials.append(leaf_mid)
    # Smooth organic botanical curvature + thin leaf thickness (ZERO faceted polygonal leaf cards!)
    sub = leaves_obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    sol_l = leaves_obj.modifiers.new("Solidify", "SOLIDIFY")
    sol_l.thickness = 2.0 * MM
    bpy.context.view_layer.objects.active = leaves_obj
    bpy.ops.object.modifier_apply(modifier=sub.name)
    bpy.ops.object.modifier_apply(modifier=sol_l.name)

    out_blend = os.path.join(OUT_DIR, "fiddle_fig.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_window_curtain():
    """Warm organic pleated heavyweight linen curtain panel (0.74m W x 2.68m H) with woven linen texture."""
    clear_scene()
    linen = make_linen_curtain_mat()

    bm = bmesh.new()
    uv_l = bm.loops.layers.uv.new("UVMap")
    W = 0.74
    H = 2.68
    nx, nz = 42, 24
    verts = []
    for iz in range(nz + 1):
        row = []
        vz = iz / nz  # 0 bottom .. 1 top
        z = vz * H
        for ix in range(nx + 1):
            ux = ix / nx
            x = (ux - 0.5) * W
            # Soft natural organic pinch-pleat linen drape (asymmetric multi-harmonic folds, zero stiff sinusoid!)
            fold1 = math.sin(ux * math.pi * 4.5 + 0.65 * math.sin(vz * 2.1 + ux * 1.4)) * 0.044
            fold2 = math.sin(ux * math.pi * 7.8 + 1.9 + vz * 0.9) * 0.018 * (0.5 + 0.5 * vz)
            fold3 = math.cos(ux * math.pi * 2.3 - vz * 2.2) * 0.022 * (1.0 - vz * 0.35)
            y = (fold1 + fold2 + fold3) * (0.86 + 0.14 * vz)
            # Subtle graceful flare at floor hem
            x_gather = x * (1.04 - 0.06 * vz)
            row.append(bm.verts.new((x_gather, y, z)))
        verts.append(row)
    for iz in range(nz):
        for ix in range(nx):
            f = bm.faces.new((verts[iz][ix], verts[iz][ix + 1], verts[iz + 1][ix + 1], verts[iz + 1][ix]))
            f.smooth = True
            for lp in f.loops:
                lp[uv_l].uv = ((lp.vert.co.x / W + 0.5) * 3.0, (lp.vert.co.z / H) * 9.0)

    me = bpy.data.meshes.new("Curtain_Mesh")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("Window_Curtain", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(linen)

    sol = obj.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.008
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sol.name)

    out_blend = os.path.join(OUT_DIR, "window_curtain.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_aeron_chair()
    build_anglepoise_lamp()
    build_coffee_mug()
    build_fiddle_fig()
    build_window_curtain()
