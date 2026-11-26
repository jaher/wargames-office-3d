#!/usr/bin/env python3
"""Build accurate Meta Ray-Ban Display Smart Glasses AND Meta Neural Band (sEMG Wristband) in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js in the browser — ZERO Blender Cycles rendering!).
Crafted to match the real Meta Ray-Ban Display ecosystem (Shiny Black + Charcoal Black Neural Band):
1. Meta Ray-Ban Display Glasses (~148 x 150 x 47 mm):
   - Classic Wayfarer silhouette in Shiny Black polished acetate with authentic sculpted nose bridge & thick smart temples
   - Subtle flush circular camera lens in upper-left frame corner + tiny white LED privacy indicator in upper-right corner
   - Iconic silver oval hinge pins on front corners & sleek silver Ray-Ban temple accents
   - Gently curved dark-tinted reflective Transitions lenses with ultra-subtle right-lens AR micro-display waveguide glint
2. Meta Neural Band (~70 x 56 x 26 mm elliptical sEMG wristband):
   - Sleek minimalist Charcoal Black high-performance soft-touch woven textile strap
   - Interior low-profile matte dark-titanium sEMG muscle-sensor contact pads & subtle outer status pill + clasp seam

Outputs:
  assets/blender/meta_rayban_display.blend
  assets/blender/meta_neural_band.blend
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector

MM = 0.001
OUT_DIR = os.path.abspath("/workspace/assets/blender")
os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def make_mat(name, color, metallic=0.1, roughness=0.3, alpha=1.0, emit=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emit is not None:
        bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=3, rot=(0, 0, 0)):
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
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_cyl(name, r, depth, loc, rot, mat, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_frame_rim(name, cx, cz, rx, rz, thick, depth, mat):
    """Build a sculpted classic Wayfarer rounded-trapezoid acetate lens rim via smooth closed bevelled curve."""
    pts = []
    n = 36
    for i in range(n):
        a = (i / n) * math.pi * 2.0
        ca, sa = math.cos(a), math.sin(a)
        # Authentic Wayfarer shape: slightly flatter browline at top, tapered rounded lower cheek curve
        sx = ca * rx * (1.06 if sa > 0 else 0.92)
        sz = sa * rz * (0.86 if sa > 0 else 1.05)
        # Subtle outward flare on top outer corners
        if sa > 0.25:
            sx *= 1.05
        pts.append((cx + sx, -0.0, cz + sz))

    cd = bpy.data.curves.new(name, type="CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = thick
    cd.bevel_resolution = 6
    sp = cd.splines.new("POLY")
    sp.use_cyclic_u = True
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    obj = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(obj)
    obj.scale = (1.0, depth / max(thick * 2.0, 1e-4), 1.0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_temple_arm(name, side, mat):
    """Build a sculpted slightly thicker Meta Ray-Ban Display smart temple arm (houses waveguide optics & speakers)."""
    s = side  # -1 left, +1 right
    pts = [
        (s * 71 * MM, 2 * MM, 31 * MM),
        (s * 73 * MM, 36 * MM, 31 * MM),
        (s * 72 * MM, 76 * MM, 30 * MM),
        (s * 68 * MM, 114 * MM, 27 * MM),
        (s * 62 * MM, 134 * MM, 18 * MM),
        (s * 57 * MM, 144 * MM, 9 * MM),
    ]
    bm = bmesh.new()
    rings = []
    # Thicker sculpted smart-temple cross-section tapering cleanly toward ear tip
    widths = [4.8 * MM, 5.2 * MM, 5.0 * MM, 4.4 * MM, 3.8 * MM, 3.2 * MM]
    heights = [13.5 * MM, 12.2 * MM, 10.2 * MM, 8.0 * MM, 6.8 * MM, 5.8 * MM]
    for (px, py, pz), w, h in zip(pts, widths, heights):
        ring = []
        for i in range(12):
            a = (i / 12) * math.pi * 2.0
            vx = px + math.cos(a) * w * 0.5
            vz = pz + math.sin(a) * h * 0.5
            ring.append(bm.verts.new((vx, py, vz)))
        rings.append(ring)
    for ri in range(len(rings) - 1):
        for i in range(12):
            ni = (i + 1) % 12
            f = bm.faces.new((rings[ri][i], rings[ri][ni], rings[ri + 1][ni], rings[ri + 1][i]))
            f.smooth = True
    bm.faces.new(rings[0][::-1]).smooth = True
    bm.faces.new(rings[-1]).smooth = True
    me = bpy.data.meshes.new(name + "_M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def build_meta_rayban_display():
    clear_scene()
    # Shiny Black polished acetate frame (authentic Meta Ray-Ban Display finish!)
    acetate = make_mat("MetaRB_ShinyBlack", (0.014, 0.015, 0.018), metallic=0.08, roughness=0.14)
    lens_left = make_mat("MetaRB_Lens", (0.035, 0.045, 0.055), metallic=0.18, roughness=0.05, alpha=0.46)
    # Right lens carries the ultra-subtle Meta Display monocular waveguide tint!
    lens_right = make_mat("MetaRB_DisplayLens", (0.04, 0.07, 0.08), metallic=0.22, roughness=0.05, alpha=0.50, emit=(0.18, 0.52, 0.62), emit_strength=0.10)
    silver_pin = make_mat("MetaRB_SilverAccent", (0.78, 0.80, 0.84), metallic=0.94, roughness=0.18)
    cam_glass = make_mat("MetaRB_CameraLens", (0.02, 0.03, 0.06), metallic=0.50, roughness=0.06)
    privacy_led = make_mat("MetaRB_PrivacyLED", (0.95, 0.97, 1.0), metallic=0.0, roughness=0.2, emit=(0.95, 0.97, 1.0), emit_strength=1.4)

    # 1. Wayfarer Front Frame Rims + Keyhole Nose Bridge + Sculpted Brow Bar
    frame_z = 25 * MM
    add_frame_rim("RayBan_RimL", -35.5 * MM, frame_z, 26.5 * MM, 21.5 * MM, 3.3 * MM, 6.2 * MM, acetate)
    add_frame_rim("RayBan_RimR", 35.5 * MM, frame_z, 26.5 * MM, 21.5 * MM, 3.3 * MM, 6.2 * MM, acetate)
    # Continuous glossy Wayfarer brow bar & keyhole bridge
    add_box("RayBan_Bridge", (22 * MM, 5.8 * MM, 8.5 * MM), (0, 0, frame_z + 11 * MM), acetate, bevel=2.4 * MM)
    for sx in (-1, 1):
        # Sculpted outer corner lugs housing camera (left) & LED (right)
        add_box(f"RayBan_CornerLug_{sx}", (16 * MM, 6.8 * MM, 13.5 * MM), (sx * 66 * MM, 0.8 * MM, frame_z + 10 * MM), acetate, bevel=2.8 * MM)
        # Classic silver Ray-Ban hinge rivet accent on outer brow corners + silver temple emblem
        add_cyl(f"RayBan_HingePin_{sx}", 1.8 * MM, 1.4 * MM, (sx * 68 * MM, -2.5 * MM, frame_z + 10 * MM), (math.pi / 2, 0, 0), silver_pin, 12)
        add_box(f"RayBan_TempleLogo_{sx}", (1.2 * MM, 14 * MM, 3.2 * MM), (sx * 74.2 * MM, 24 * MM, 31 * MM), silver_pin, bevel=0.4 * MM)

    # Flush circular 12MP camera lens (upper-left corner) + tiny privacy LED indicator (upper-right corner)
    add_cyl("RayBan_CameraRing", 3.4 * MM, 1.8 * MM, (-64.5 * MM, -2.7 * MM, frame_z + 10.2 * MM), (math.pi / 2, 0, 0), silver_pin, 16)
    add_cyl("RayBan_CameraOptic", 2.3 * MM, 2.2 * MM, (-64.5 * MM, -2.9 * MM, frame_z + 10.2 * MM), (math.pi / 2, 0, 0), cam_glass, 16)
    add_cyl("RayBan_PrivacyLED", 1.8 * MM, 1.8 * MM, (64.5 * MM, -2.7 * MM, frame_z + 10.2 * MM), (math.pi / 2, 0, 0), privacy_led, 14)

    # 2. Transitions Lenses (right lens features subtle waveguide optics sheen!)
    for sx, lmat, lname in [(-1, lens_left, "LensL"), (1, lens_right, "LensR")]:
        add_cyl(f"RayBan_{lname}", 24.0 * MM, 1.6 * MM, (sx * 35.5 * MM, 0.0, frame_z - 0.5 * MM), (math.pi / 2, 0, 0), lmat, 32)
        bpy.context.active_object.scale = (1.06, 1.0, 0.86)
        bpy.ops.object.transform_apply(scale=True)

    # 3. Sculpted Smart Temple Arms (unfolded, resting stably on desk!)
    add_temple_arm("RayBan_TempleL", -1, acetate)
    add_temple_arm("RayBan_TempleR", 1, acetate)

    out_blend = os.path.join(OUT_DIR, "meta_rayban_display.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_meta_neural_band():
    clear_scene()
    # Charcoal Black woven high-performance soft-touch textile (Vectran-weave look) + matte titanium EMG pods
    band_fabric = make_mat("NeuralBand_CharcoalTextile", (0.046, 0.049, 0.056), metallic=0.05, roughness=0.88)
    band_edge = make_mat("NeuralBand_EdgeTrim", (0.028, 0.031, 0.036), metallic=0.14, roughness=0.72)
    emg_pod = make_mat("NeuralBand_EMGPod", (0.14, 0.15, 0.17), metallic=0.78, roughness=0.34)
    clasp_metal = make_mat("NeuralBand_Clasp", (0.18, 0.19, 0.22), metallic=0.86, roughness=0.28)
    status_led = make_mat("NeuralBand_StatusLED", (0.45, 0.88, 0.82), metallic=0.0, roughness=0.20, emit=(0.45, 0.88, 0.82), emit_strength=1.6)

    # 1. Sculpted Elliptical Wristband Loop resting upright/slightly canted on the desk (72 x 58 mm oval, 26 mm band width)
    bm = bmesh.new()
    rx_out, ry_out = 36 * MM, 28 * MM
    thick = 4.6 * MM
    bw = 25.5 * MM
    n_seg = 48
    # 4-corner rounded cross-section swept cleanly around elliptical wrist loop
    prof = [
        (-thick * 0.5, -bw * 0.44),
        (-thick * 0.35, -bw * 0.50),
        (thick * 0.35, -bw * 0.50),
        (thick * 0.5, -bw * 0.44),
        (thick * 0.5, bw * 0.44),
        (thick * 0.35, bw * 0.50),
        (-thick * 0.35, bw * 0.50),
        (-thick * 0.5, bw * 0.44),
    ]
    rings = []
    for i in range(n_seg):
        a = (i / n_seg) * math.pi * 2.0
        ca, sa = math.cos(a), math.sin(a)
        cx, cy = ca * rx_out, sa * ry_out
        # Outward normal approximation
        nx, ny = ca / rx_out, sa / ry_out
        nl = math.hypot(nx, ny)
        nx /= nl
        ny /= nl
        # Subtle ribbed textile texture ripple along outer circumference
        rib = 0.25 * MM * math.sin(i * 4.0)
        ring = []
        for dr, dz in prof:
            r_eff = dr + (rib if dr > 0 else 0.0)
            ring.append(bm.verts.new((cx + nx * r_eff, cy + ny * r_eff, bw * 0.5 + dz)))
        rings.append(ring)
    np = len(prof)
    for i in range(n_seg):
        ni = (i + 1) % n_seg
        for j in range(np):
            nj = (j + 1) % np
            f = bm.faces.new((rings[i][j], rings[i][nj], rings[ni][nj], rings[ni][j]))
            f.smooth = True
    me = bpy.data.meshes.new("NeuralBand_StrapM")
    bm.to_mesh(me)
    bm.free()
    strap = bpy.data.objects.new("NeuralBand_Strap", me)
    bpy.context.scene.collection.objects.link(strap)
    strap.data.materials.append(band_fabric)

    # 2. Sleek Flush Outer Matte-Titanium Clasp / Control Pod + Subtle Cyan-Teal Status Indicator LED
    add_box("NeuralBand_ClaspPlate", (14 * MM, 5.8 * MM, 22 * MM), (0, -ry_out - 0.5 * MM, bw * 0.5), clasp_metal, bevel=1.4 * MM)
    add_cyl("NeuralBand_StatusLED", 1.1 * MM, 1.5 * MM, (0, -ry_out - 3.2 * MM, bw * 0.5), (math.pi / 2, 0, 0), status_led, 12)

    # 3. 8 Low-Profile Matte-Titanium Interior sEMG Electrode Pods lining the inner band wall!
    for k in range(8):
        a = (k / 8) * math.pi * 2.0 + math.pi / 8
        px = math.cos(a) * (rx_out - 2.6 * MM)
        py = math.sin(a) * (ry_out - 2.6 * MM)
        add_box(f"NeuralBand_EMG_{k}", (7.5 * MM, 2.2 * MM, 14.0 * MM), (px, py, bw * 0.5), emg_pod, bevel=0.7 * MM, rot=(0, 0, a + math.pi / 2))

    # Subtle stitched top/bottom edge trim rings
    for sz in (1.2 * MM, bw - 1.2 * MM):
        bpy.ops.mesh.primitive_torus_add(major_radius=32 * MM, minor_radius=0.8 * MM, major_segments=48, minor_segments=10, location=(0, 0, sz))
        tr = bpy.context.active_object
        tr.name = f"NeuralBand_Trim_{sz:.3f}"
        tr.scale = (rx_out / (32 * MM), ry_out / (32 * MM), 1.0)
        bpy.ops.object.transform_apply(scale=True)
        tr.data.materials.append(band_edge)

    out_blend = os.path.join(OUT_DIR, "meta_neural_band.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_meta_rayban_display()
    build_meta_neural_band()
