#!/usr/bin/env bash
# Blind Independent Visual Verifier (fresh agy --print process with zero build memory).
# Usage:
#   scripts/run_blind_verifier.sh <image_path> <subject_id> [reference_image_path]
set -euo pipefail

IMG_PATH="${1:?Missing image path}"
SUBJECT="${2:?Missing subject id}"
REF_PATH="${3:-}"

case "$SUBJECT" in
  overview)
    CRITERIA="Judge this live Three.js 3D office browser screenshot against the visual quality of felixrieseberg.com (reference image provided). Check:
1. Overall atmosphere, warm photographic lighting, shadows, materials, and visual cohesion vs felixrieseberg.com (does it look rich, warm, and cinematic or flat/CG/cartoonish?).
2. Outside window view: MUST be extremely realistic — photographic skyline depth, fine-scale realistic architectural office windows (NOT giant blocky LEGO squares!), distant atmospheric haze, bridges/water/landmarks, sky/sun/clouds, window framing & curtains (no geometry clipping!).
3. Desktop monitor readability: is the Omarchy Linux desktop & terminal text clearly visible and legible with zero glare blowout?
4. Desk layout & peripherals: NO speakers should be anywhere in the office (flag any speaker as a defect!). The 8-node GB10 desktop stack (6x champagne-gold NVIDIA DGX Spark with front NVIDIA logos + 2x Stellar Grey ASUS Ascent GX10 at the base) and MikroTik CRS804 switch MUST sit on the desk alongside the monitor. Check realistic shapes, proportions, materials, and zero clipping for Corsair black aluminum keyboard (volume roller) & Corsair wireless mouse, Meta Ray-Ban Display glasses & Meta Neural Band on the desk, Tripp Lite ISOBAR8ULTRA surge suppressor on the floor under the desk with power cables running into it, Anglepoise lamp, books, mug, Herman Miller Aeron chair (mesh visible!), walnut desk, rug, floor, walls, plants.
5. Corsair 5000D Airflow PC tower visibility & RTX 5090 legibility on the right side of the desk.
6. Any clipping, floating parts, black viewport margins, UI bugs, or visual artifacts."
    ;;
  monitor)
    CRITERIA="Judge this close-up 3D browser screenshot of the Omarchy Linux monitor against real Omarchy Linux (basecamp/omarchy by DHH: Arch Linux + Hyprland borderless tiling + minimal Waybar top bar + Tokyo Night theme + Alacritty/Ghostty terminal + fastfetch/btop). Check:
1. Framing & viewport: is the full monitor cleanly visible with no clipping, no black margins, and crisp legibility?
2. Waybar authenticity: thin top bar, Omarchy glyph + minimal workspace indicators on left, clean centered clock, minimal Nerd-Font-style system modules on right — no cramped or clipped pills.
3. Hyprland authenticity: borderless tiled windows (NO macOS traffic-light dots!), crisp thin active accent border, clean gaps showing a realistic Tokyo Night wallpaper.
4. Terminal & OverTheWire solution readability: crisp monospace font, authentic prompt/output, zero passwords exposed, clearly readable.
5. Physical Dell UltraSharp 34\" monitor bezel, chin, aluminum stand, and zero glare blowout."
    ;;
  pc)
    CRITERIA="Judge this close-up screenshot/render of the ORIGIN PC Millennium Prime (Corsair 5000D Airflow black, top I/O) build against every exact real-world component:
1. Case & Exterior: Corsair 5000D Airflow black (245x520x520mm), matte black steel chassis, triangular-perforated front/top airflow mesh, Corsair sails branding, top I/O with yellow USB ports, tinted tempered glass side panel, PSU shroud cutout window visibly showing the Corsair HX1500i Platinum PSU side label.
2. Internals: MSI PRO Z890-P WIFI ATX motherboard (black PCB + silver slotted VRM/Rear I/O/chipset heatsinks), EXACTLY TWO (2) Corsair VENGEANCE 96GB (2x48GB) non-RGB low-profile matte-black DDR5 RAM sticks in slots A2 & B2, Corsair iCUE LINK TITAN 360 RX RGB AIO (geometric CapSwap pump dome with RGB ring + 360mm radiator + braided hoses) + 7x Corsair iCUE LINK RX120 RGB fans, BOTH M.2 NVMe drives visible (Corsair MP700 PRO 4TB Gen5 heatsink above GPU + Corsair MP600 CORE XT R2 1TB below GPU), Corsair Type-4 Gen 4 black individually-sleeved cables + Corsair 600W 12V-2x6 GPU cable.
3. GPU: NVIDIA GeForce RTX 5090 Founders Edition 32GB (true sleek 2-slot 304x137x40mm dark gunmetal/titanium pill-rounded exoskeleton with open side fin channels exposing vertical black fins, continuous hourglass X-frame with white inner-V light guides, dual symmetrical open flow-through curved fin bays, crisp backlit 'GEFORCE RTX' side spine branding, right-side-up 'RTX 5090' center backplate branding, deeply recessed 45-degree angled 12V-2x6 connector).
4. Material realism, lighting, tempered glass reflections, and zero clipping/z-fighting."
    ;;
  gpu)
    CRITERIA="Judge this macro close-up 3D browser screenshot of the NVIDIA GeForce RTX 5090 Founders Edition (part 900-1G144-2530-000) strictly against real-world NVIDIA GeForce RTX 5090 Founders Edition product photographs from every angle:
1. Exact Dimensions & Silhouette: 304 x 137 x 40 mm true 2.0-slot thickness with large smooth rounded pill/stadium corners (R~26mm) — NOT a boxy rectangular slab!
2. Iconic Side Profile: Sleek top & bottom dark satin-titanium perimeter lips framing deeply recessed OPEN side channels along the rear & front thirds that visibly expose tightly packed VERTICAL jet-black anodized heatsink fins; sculpted central full-height gunmetal side bridge with crisp white backlit 'GEFORCE RTX' (NO '5090' on the side edge!) to the left and a deeply recessed angled (~45 deg) 12V-2x6 power connector cavity cleanly integrated into the side bridge.
3. Top Backplate & Double Flow-Through Architecture: Continuous sculpted hourglass/figure-8 satin-titanium X-frame sweeping smoothly between the rounded outer rails and central waist; subtle neutral-white recessed inner-V LED light guides along the X-frame arms; TWO large symmetrical open Double Flow-Through fin bays filled with dense, subtly curved 3D blackened-aluminum fins (with underside axial fans subtly visible through the open bays); solid matte-black center diamond core with crisp, understated right-side-up 'RTX 5090' typography.
4. Material & Surface Realism: Authentic brushed dark satin gunmetal/titanium anodized aluminum, deep jet-black anodized fins with crisp metallic edge catchlights, dark-anodized 2-slot rear PCIe bracket, zero mesh clipping, zero gaps, zero sticker seams, and museum-grade hardware accuracy."
    ;;
  cluster)
    CRITERIA="Judge this close-up live Three.js screenshot of the 8-node GB10 stack (6x NVIDIA DGX Spark + 2x ASUS Ascent GX10) + MikroTik CRS804-4DDQ-hRM switch sitting ON THE WALNUT DESK alongside the monitor against the real hardware products. Check:
1. 6x NVIDIA DGX Spark (top 6 units): exact compact proportions (150x150x50.5mm), champagne-gold anodized aluminum chassis, iconic porous gold metal-foam front & rear fascia, crisp centered front NVIDIA eye-claw + NVIDIA logo badge on each unit, and laser-etched top branding.
2. 2x ASUS Ascent GX10 (bottom 2 units): exact compact proportions (150x150x51mm), sleek Stellar Grey brushed/anodized aluminum unibody, tightly spaced vertical front cooling louver vents, minimalist ASUS / GX10 front branding, and discreet flush square power button with illuminated status LED.
3. MikroTik CRS804-4DDQ-hRM switch: exact half-width 1U proportions (218x387x44mm), industrial silver-steel chassis with dark anodized faceplate, front panel layout (recessed reset, PWR/USR/FAULT LEDs, RJ45 console, 2x 10GbE RJ45, 4x 400G QSFP56-DD stainless cages with transceivers/pull-tabs), crisp MikroTik CRS804-4DDQ-hRM silkscreen (unobstructed by pull-tabs), symmetrical rack ears.
4. Cabling: clean realistic 400G-to-2x200GbE breakout DAC cables connecting the 4 right-side QSFP-DD ports of the CRS804 to the 8 nodes without awkward clipping or spaghetti mess.
5. Placement on walnut desk next to monitor/PC (zero overlapping/clipping with neighbors, no speakers), lighting, contact shadows, and overall photorealism."
    ;;
  window)
    CRITERIA="Judge this Skyline View screenshot against the outside environment quality of felixrieseberg.com (reference image provided). Check:
1. City skyline photorealism: fine-scale realistic architectural office windows (NOT big chunky blocky squares!), varied skyscraper silhouettes, spires, distant atmospheric haze, bridges/water/landmarks, realistic glowing city lights & signs (no floating boxes).
2. Sky, sun, and volumetric clouds: believable atmospheric gradient, natural scattering, cohesive color palette.
3. Window frame, mullions, curtains, and glass realism (no geometry clipping!).
4. Would a demanding art director say the view feels as good as felixrieseberg.com?"
    ;;
  *)
    CRITERIA="Judge this 3D product render against its real-world counterpart ($SUBJECT). Check exact proportions, silhouette, surface materials, ports/details, lighting, and any geometry or shading defects."
    ;;
esac

REF_NOTE=""
if [[ -n "$REF_PATH" && -f "$REF_PATH" ]]; then
  REF_NOTE="Also read the visual reference image at ${REF_PATH} and compare directly side-by-side."
fi

PROMPT="You are a ruthless, independent blind 3D art director and hardware-accuracy verifier. You have ZERO memory of how this image was made and NO sympathy for 'good enough'.

First, use read_file to inspect the image at: ${IMG_PATH}
${REF_NOTE}

Evaluation criteria for [${SUBJECT}]:
${CRITERIA}

Return your strict verdict in this exact format:
VERDICT: PASS or FAIL
SCORE: X/10
STRENGTHS:
- (bullet list, max 3)
DEFECTS_TO_FIX:
- (concrete, specific, actionable visual defects ranked by severity; if VERDICT is PASS, write 'None critical')

Be brutally honest. Only return VERDICT: PASS if the image genuinely achieves >= 8.5/10 photorealism and hardware fidelity matching felixrieseberg.com and the real products."

agy --dangerously-skip-permissions --disable-slash-commands --effort medium --print="$PROMPT"
