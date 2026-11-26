#!/usr/bin/env python3
"""Build remaining real-world office props as clean Blender geometry (no Cycles rendering):
1. Organic Sansevieria (Snake Plant) in ribbed ceramic planter (`snake_plant.blend`) —
   sculpted twisted wavy variegated sword leaves with yellow-gold outer margins.
2. Realistic Stacked Hardcover Reference Books (`desk_books.blend`) — distinct overhanging
   cloth-bound covers, rounded spines with subtle foil bands, and recessed cream page blocks.

Outputs:
  assets/blender/snake_plant.blend
  assets/blender/desk_books.blend
"""
import math
import os
import random
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler
from PIL import Image, ImageDraw

MM = 0.001
OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def make_mat(name, color, metallic=0.0, roughness=0.55, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Clearcoat"].default_value = coat
    return mat


def make_tex_mat(name, path, roughness=0.42, coat=0.18):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Clearcoat"].default_value = coat
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(path)
    img.pack()
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def generate_sansevieria_leaf_texture():
    """Generate authentic variegated Sansevieria trifasciata 'Laurentii' leaf texture (dark mottled bands + golden edges)."""
    w, h = 256, 512
    img = Image.new("RGB", (w, h), (42, 86, 48))
    d = ImageDraw.Draw(img)
    rng = random.Random(314)
    # Horizontal mottled lighter sage-green cross-banding characteristic of real Snake Plants!
    for y in range(0, h, 8):
        if rng.random() < 0.55:
            bh = rng.randint(4, 14)
            shade = rng.randint(14, 34)
            d.rectangle((22, y, w - 22, y + bh), fill=(42 + shade, 86 + shade + 12, 48 + shade // 2))
    # Signature golden-chartreuse Laurentii margins along both outer leaf edges!
    d.rectangle((0, 0, 22, h), fill=(166, 178, 72))
    d.rectangle((w - 22, 0, w, h), fill=(166, 178, 72))
    d.rectangle((22, 0, 28, h), fill=(92, 132, 60))
    d.rectangle((w - 28, 0, w - 22, h), fill=(92, 132, 60))
    path = os.path.join(TEX_DIR, "sansevieria_leaf.png")
    img.save(path)
    return path


def build_snake_plant():
    clear_scene()
    leaf_tex = generate_sansevieria_leaf_texture()
    pot_mat = make_mat("Planter_WarmStone", (0.20, 0.185, 0.17), metallic=0.0, roughness=0.84)
    soil_mat = make_mat("Planter_DarkSoil", (0.08, 0.06, 0.045), metallic=0.0, roughness=0.96)
    leaf_mat = make_tex_mat("Sansevieria_Leaf", leaf_tex, roughness=0.60, coat=0.05)

    # 1. Sculpted ribbed ceramic planter pot (340mm dia x 340mm H)
    bpy.ops.mesh.primitive_cone_add(vertices=36, radius1=132 * MM, radius2=168 * MM, depth=330 * MM, location=(0, 0, 165 * MM))
    pot = bpy.context.active_object
    pot.name = "SnakePlanter_Pot"
    pot.data.materials.append(pot_mat)
    for p in pot.data.polygons:
        p.use_smooth = True
    # Sculpted rolled ceramic rim
    bpy.ops.mesh.primitive_torus_add(major_radius=166 * MM, minor_radius=13 * MM, major_segments=36, minor_segments=12, location=(0, 0, 326 * MM))
    rim = bpy.context.active_object
    rim.name = "SnakePlanter_Rim"
    rim.data.materials.append(pot_mat)
    for p in rim.data.polygons:
        p.use_smooth = True
    # Subtle horizontal decorative ceramic grooves
    for rz in (95 * MM, 175 * MM, 255 * MM):
        r_ring = 132 * MM + (rz / (330 * MM)) * 36 * MM
        bpy.ops.mesh.primitive_torus_add(major_radius=r_ring, minor_radius=3.5 * MM, major_segments=36, minor_segments=8, location=(0, 0, rz))
        g_ring = bpy.context.active_object
        g_ring.name = f"Pot_Rib_{rz:.2f}"
        g_ring.data.materials.append(pot_mat)
        for p in g_ring.data.polygons:
            p.use_smooth = True

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=156 * MM, depth=20 * MM, location=(0, 0, 312 * MM))
    soil = bpy.context.active_object
    soil.name = "SnakePlanter_Soil"
    soil.data.materials.append(soil_mat)

    # 2. 15 Organic Twisted Ribbon-Like Variegated Sword Leaves (batched smooth bmesh with UVs!)
    rng = random.Random(424)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    n_leaves = 15
    for i in range(n_leaves):
        ang = (i / n_leaves) * math.pi * 2.0 + rng.uniform(-0.22, 0.22)
        rad = rng.uniform(18 * MM, 102 * MM)
        bx, by = math.cos(ang) * rad, math.sin(ang) * rad
        height = rng.uniform(420 * MM, 760 * MM)
        max_w = rng.uniform(44 * MM, 64 * MM)
        lean = rng.uniform(0.05, 0.22)
        twist_total = rng.uniform(-0.85, 0.85)
        wave_phase = rng.uniform(0, math.pi * 2)

        segs_z = 12
        rows = []
        for iz in range(segs_z + 1):
            t = iz / segs_z
            # Natural sword leaf taper: narrow base -> broad mid blade -> sharp tip
            w_prof = math.sin(t * math.pi) ** 0.55 * (1.0 - 0.15 * t)
            if t < 0.12:
                w_prof = max(w_prof, 0.42)
            if iz == segs_z:
                w_prof = 0.04
            w_cur = max_w * w_prof
            z = 308 * MM + t * height
            # Gentle organic outward arch + natural longitudinal twist
            out_r = (t ** 1.45) * lean * height
            cx = bx + math.cos(ang) * out_r
            cy = by + math.sin(ang) * out_r
            yaw = ang + math.pi * 0.5 + t * twist_total
            ux, uy = math.cos(yaw), math.sin(yaw)
            nx, ny = -uy, ux  # Cup cross-section normal

            row = []
            for iu, u in enumerate([-1.0, -0.45, 0.0, 0.45, 1.0]):
                cup = (1.0 - u * u) * -9.0 * MM * (1.0 - t * 0.6)
                wave = math.sin(t * 7.5 + wave_phase) * 5.0 * MM * abs(u)
                px = cx + ux * (u * w_cur * 0.5) + nx * (cup + wave)
                py = cy + uy * (u * w_cur * 0.5) + ny * (cup + wave)
                row.append((bm.verts.new((px, py, z)), (u + 1.0) * 0.5, t))
            rows.append(row)

        for iz in range(segs_z):
            for iu in range(4):
                v00, u00, t00 = rows[iz][iu]
                v10, u10, t10 = rows[iz][iu + 1]
                v11, u11, t11 = rows[iz + 1][iu + 1]
                v01, u01, t01 = rows[iz + 1][iu]
                f = bm.faces.new((v00, v10, v11, v01))
                f.smooth = True
                for loop, uv in zip(f.loops, [(u00, t00), (u10, t10), (u11, t11), (u01, t01)]):
                    loop[uv_layer].uv = uv

    me = bpy.data.meshes.new("SnakeLeaves_Mesh")
    bm.to_mesh(me)
    bm.free()
    leaves_obj = bpy.data.objects.new("SnakePlant_Leaves", me)
    bpy.context.scene.collection.objects.link(leaves_obj)
    leaves_obj.data.materials.append(leaf_mat)
    # Smooth organic botanical sword curvature + thin leaf thickness!
    sub = leaves_obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    sol = leaves_obj.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 2.4 * MM
    bpy.context.view_layer.objects.active = leaves_obj
    bpy.ops.object.modifier_apply(modifier=sub.name)
    bpy.ops.object.modifier_apply(modifier=sol.name)

    out_blend = os.path.join(OUT_DIR, "snake_plant.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_desk_books():
    """Realistic stacked cloth-bound hardcover books with overhanging boards, rounded spines & recessed cream pages."""
    clear_scene()
    pages_mat = make_mat("Book_CreamPages", (0.88, 0.84, 0.76), roughness=0.88)
    foil_mat = make_mat("Book_GoldFoil", (0.82, 0.68, 0.36), metallic=0.90, roughness=0.28)
    covers = [
        ("Book_NavyCloth", (0.11, 0.17, 0.25)),
        ("Book_TerracottaCloth", (0.42, 0.16, 0.11)),
        ("Book_SageCloth", (0.28, 0.33, 0.29)),
    ]
    specs = [
        (225 * MM, 162 * MM, 28 * MM, 0.06, 0),
        (206 * MM, 150 * MM, 24 * MM, -0.05, 1),
        (188 * MM, 138 * MM, 20 * MM, 0.11, 2),
    ]

    z_cur = 0.0
    for idx, (bw, bd, bh, yaw, c_idx) in enumerate(specs):
        cname, ccol = covers[c_idx]
        cmat = make_mat(cname, ccol, roughness=0.82)
        rot = (0, 0, yaw)
        rot_m = Euler(rot).to_matrix()

        def place_part(name, sz, local_off, mat, bev=0.0):
            world_off = rot_m @ Vector(local_off)
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(world_off.x, world_off.y, z_cur + world_off.z), rotation=rot)
            o = bpy.context.active_object
            o.name = name
            o.scale = sz
            bpy.ops.object.transform_apply(scale=True)
            if bev > 0:
                m = o.modifiers.new("Bevel", "BEVEL")
                m.width = bev
                m.segments = 2
                bpy.ops.object.modifier_apply(modifier=m.name)
            o.data.materials.append(mat)
            return o

        board_t = 3.0 * MM
        # Bottom & Top overhanging hardcover boards
        place_part(f"Book{idx}_BotBoard", (bw, bd, board_t), (0, 0, board_t * 0.5), cmat, bev=0.8 * MM)
        place_part(f"Book{idx}_TopBoard", (bw, bd, board_t), (0, 0, bh - board_t * 0.5), cmat, bev=0.8 * MM)
        # Rounded hardcover spine facing -Y (front toward viewer)
        place_part(f"Book{idx}_Spine", (bw, 5.5 * MM, bh), (0, -bd * 0.5 + 2.5 * MM, bh * 0.5), cmat, bev=1.8 * MM)
        # Subtle gold-foil embossed title band on spine
        place_part(f"Book{idx}_Foil", (bw * 0.42, 1.2 * MM, 3.2 * MM), (0, -bd * 0.5 - 0.3 * MM, bh * 0.5), foil_mat)
        # Recessed cream page block inside overhanging covers!
        place_part(f"Book{idx}_Pages", (bw - 8 * MM, bd - 7 * MM, bh - 2 * board_t), (0, 2.0 * MM, bh * 0.5), pages_mat)

        z_cur += bh

    out_blend = os.path.join(OUT_DIR, "desk_books.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_snake_plant()
    build_desk_books()
