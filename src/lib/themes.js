/* Stati, ruoli e i 10 temi (colori, font e forme per-tema) */

export const STATI = [
  { id: "da_imparare", label: "Da imparare" },
  { id: "in_prova", label: "In prova" },
  { id: "quasi_pronta", label: "Quasi pronta" },
  { id: "pronta", label: "Pronta" },
];
export const statoDi = (id) => STATI.find((s) => s.id === id) || STATI[0];
export const nextStato = (id) => STATI[Math.min(STATI.findIndex((s) => s.id === id) + 1, STATI.length - 1)].id;

export const RUOLI = ["Musicista", "Voce", "Chitarra", "Basso", "Batteria", "Tastiere", "Sax", "Violino", "Fonico", "Manager", "Altro"];

export const AVATAR_COLORS = ["#E8734A", "#4A90E8", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899"];

export const fmtDur = (sec) => {
  if (!sec && sec !== 0) return "—";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

export const THEMES = {
  neon: {
    label: "Neon Stage", desc: "Luci di palco al neon", fd: "'Unbounded', sans-serif", fb: "'Space Grotesk', sans-serif", r: 13,
    status: { dark: ["#FFB340", "#FF5CA8", "#4DD6FF", "#5CFF9D"], light: ["#B36A00", "#C22370", "#0077A8", "#0F8A45"] },
    dark: { bg: "radial-gradient(1100px 500px at 15% -10%, rgba(255,92,168,.10), transparent 60%), radial-gradient(900px 500px at 85% -10%, rgba(77,214,255,.10), transparent 60%), #16112B", panel: "rgba(255,255,255,.035)", card: "#221A3E", text: "#F3EFFF", sub: "#A99CC9", faint: "#7A6F99", border: "rgba(255,255,255,.08)", chip: "rgba(255,255,255,.07)", grad: "linear-gradient(90deg,#FF5CA8,#FFB340)", logoGrad: "linear-gradient(90deg,#FFB340,#FF5CA8 40%,#4DD6FF 75%,#5CFF9D)", gradText: "#1C1030" },
    light: { bg: "radial-gradient(1100px 500px at 15% -10%, rgba(194,35,112,.06), transparent 60%), #F5F2FB", panel: "rgba(30,20,60,.04)", card: "#FFFFFF", text: "#241B3F", sub: "#6A5E8C", faint: "#9A8FBB", border: "rgba(30,20,60,.12)", chip: "rgba(30,20,60,.07)", grad: "linear-gradient(90deg,#C22370,#B36A00)", logoGrad: "linear-gradient(90deg,#B36A00,#C22370 40%,#0077A8 75%,#0F8A45)", gradText: "#FFFFFF" },
  },
  vinile: {
    label: "Vinile", desc: "Giradischi e copertine anni '70", fd: "'Abril Fatface', serif", fb: "'Space Grotesk', sans-serif", r: 16,
    status: { dark: ["#E8A94B", "#D96C4F", "#7FB7A4", "#C9D45C"], light: ["#9A6410", "#B03E1F", "#20705B", "#6B7A10"] },
    dark: { bg: "radial-gradient(900px 500px at 50% -15%, rgba(232,169,75,.08), transparent 60%), #1E1712", panel: "rgba(255,240,220,.04)", card: "#2B211A", text: "#F5EBDD", sub: "#BCA98F", faint: "#8A7A64", border: "rgba(245,235,221,.09)", chip: "rgba(245,235,221,.08)", grad: "linear-gradient(90deg,#D96C4F,#E8A94B)", logoGrad: "linear-gradient(90deg,#E8A94B,#D96C4F 55%,#7FB7A4)", gradText: "#241408" },
    light: { bg: "#F6EFE3", panel: "rgba(70,50,30,.045)", card: "#FFFBF3", text: "#3A2C1E", sub: "#7E6A50", faint: "#A8967C", border: "rgba(70,50,30,.14)", chip: "rgba(70,50,30,.08)", grad: "linear-gradient(90deg,#B03E1F,#9A6410)", logoGrad: "linear-gradient(90deg,#9A6410,#B03E1F 55%,#20705B)", gradText: "#FFF9EF" },
  },
  synth: {
    label: "Synthwave", desc: "Tastiere e tramonti digitali", fd: "'Unbounded', sans-serif", fb: "'Space Grotesk', sans-serif", r: 13,
    status: { dark: ["#FFD166", "#FF4D9D", "#5EE7FF", "#B692FF"], light: ["#A87700", "#C4176D", "#0083A3", "#6B3FC7"] },
    dark: { bg: "linear-gradient(180deg, #12082B 0%, #24104A 55%, #3A1257 100%)", panel: "rgba(255,255,255,.045)", card: "#241243", text: "#F4EDFF", sub: "#B39DD9", faint: "#8570AB", border: "rgba(255,255,255,.10)", chip: "rgba(255,255,255,.08)", grad: "linear-gradient(90deg,#FF4D9D,#FFD166)", logoGrad: "linear-gradient(90deg,#FFD166,#FF4D9D 45%,#5EE7FF)", gradText: "#22083D" },
    light: { bg: "linear-gradient(180deg,#F3EDFF,#FBEFF7)", panel: "rgba(50,20,90,.04)", card: "#FFFFFF", text: "#2C1650", sub: "#6E5698", faint: "#9C88C0", border: "rgba(50,20,90,.12)", chip: "rgba(50,20,90,.07)", grad: "linear-gradient(90deg,#C4176D,#A87700)", logoGrad: "linear-gradient(90deg,#A87700,#C4176D 45%,#0083A3)", gradText: "#FFF" },
  },
  jazz: {
    label: "Jazz Club", desc: "Legno scuro, ottone e luce calda", fd: "'Playfair Display', serif", fb: "'Space Grotesk', sans-serif", r: 11,
    status: { dark: ["#D9A441", "#C46A6A", "#7FA8C9", "#8FBF8F"], light: ["#8F6510", "#9E3A3A", "#2C6491", "#3B7A3B"] },
    dark: { bg: "radial-gradient(800px 420px at 50% -10%, rgba(217,164,65,.10), transparent 60%), #14100C", panel: "rgba(240,225,200,.04)", card: "#201914", text: "#F1E8DA", sub: "#B5A488", faint: "#84765E", border: "rgba(240,225,200,.09)", chip: "rgba(240,225,200,.08)", grad: "linear-gradient(90deg,#C46A6A,#D9A441)", logoGrad: "linear-gradient(90deg,#D9A441,#C46A6A 55%,#7FA8C9)", gradText: "#1B120A" },
    light: { bg: "#F4EEE4", panel: "rgba(60,45,25,.045)", card: "#FDF9F1", text: "#332818", sub: "#7C6B4E", faint: "#A5977C", border: "rgba(60,45,25,.14)", chip: "rgba(60,45,25,.08)", grad: "linear-gradient(90deg,#9E3A3A,#8F6510)", logoGrad: "linear-gradient(90deg,#8F6510,#9E3A3A 55%,#2C6491)", gradText: "#FFF8EC" },
  },
  acustico: {
    label: "Acustico", desc: "Legno chiaro, corde e carta", fd: "'Playfair Display', serif", fb: "'Space Grotesk', sans-serif", r: 15,
    status: { dark: ["#E0B36A", "#D08770", "#88B0A0", "#A3BE8C"], light: ["#96660F", "#AA4A2C", "#2F6E5A", "#4E7A2B"] },
    dark: { bg: "#191C17", panel: "rgba(230,235,220,.04)", card: "#232720", text: "#ECEFE4", sub: "#A9B29B", faint: "#7C8570", border: "rgba(230,235,220,.09)", chip: "rgba(230,235,220,.08)", grad: "linear-gradient(90deg,#D08770,#E0B36A)", logoGrad: "linear-gradient(90deg,#E0B36A,#D08770 55%,#88B0A0)", gradText: "#1C1A10" },
    light: { bg: "#F3F4EC", panel: "rgba(45,55,35,.045)", card: "#FDFDF7", text: "#2C3324", sub: "#67715A", faint: "#98A28A", border: "rgba(45,55,35,.13)", chip: "rgba(45,55,35,.08)", grad: "linear-gradient(90deg,#AA4A2C,#96660F)", logoGrad: "linear-gradient(90deg,#96660F,#AA4A2C 55%,#2F6E5A)", gradText: "#FCFCF3" },
  },
  metal: {
    label: "Heavy Metal", desc: "Nero, acciaio e rosso sangue", fd: "'Archivo Black', sans-serif", fb: "'Oswald', sans-serif", r: 2,
    status: { dark: ["#E8B33B", "#D42B2B", "#9AA5B1", "#7FD34B"], light: ["#8F6600", "#A31212", "#4A5560", "#2F7A0F"] },
    dark: { bg: "linear-gradient(180deg,#0C0C0E,#151518 60%,#1B0F10)", panel: "rgba(255,255,255,.035)", card: "#1A1A1E", text: "#EDEDEF", sub: "#9AA0A8", faint: "#5F646C", border: "rgba(255,255,255,.10)", chip: "rgba(255,255,255,.07)", grad: "linear-gradient(90deg,#D42B2B,#7A1010)", logoGrad: "linear-gradient(180deg,#F2F2F4,#8B939E 60%,#D42B2B)", gradText: "#FFF" },
    light: { bg: "#EDEDEF", panel: "rgba(20,20,25,.05)", card: "#FAFAFB", text: "#17171A", sub: "#565B63", faint: "#8A8F98", border: "rgba(20,20,25,.16)", chip: "rgba(20,20,25,.08)", grad: "linear-gradient(90deg,#A31212,#5E0808)", logoGrad: "linear-gradient(180deg,#26262B,#5A626C 60%,#A31212)", gradText: "#FFF" },
  },
  classica: {
    label: "Classica", desc: "Sala da concerto: avorio e oro", fd: "'Playfair Display', serif", fb: "Georgia, 'Times New Roman', serif", r: 6,
    status: { dark: ["#D6B25E", "#B87A8E", "#8FA6C4", "#9DB88A"], light: ["#8C6A14", "#9C4460", "#3D5E86", "#4E7038"] },
    dark: { bg: "linear-gradient(180deg,#171512,#1E1B16)", panel: "rgba(235,225,205,.04)", card: "#242019", text: "#EFE8D8", sub: "#B3A88E", faint: "#7F7660", border: "rgba(214,178,94,.22)", chip: "rgba(235,225,205,.07)", grad: "linear-gradient(90deg,#B08D2E,#D6B25E)", logoGrad: "linear-gradient(90deg,#D6B25E,#EFE8D8 60%,#D6B25E)", gradText: "#201A0C" },
    light: { bg: "#F7F3E9", panel: "rgba(80,65,30,.04)", card: "#FFFDF6", text: "#332B1C", sub: "#7B7050", faint: "#A79C7E", border: "rgba(140,106,20,.28)", chip: "rgba(80,65,30,.07)", grad: "linear-gradient(90deg,#8C6A14,#B08D2E)", logoGrad: "linear-gradient(90deg,#8C6A14,#4A3D18 60%,#8C6A14)", gradText: "#FFFBEE" },
  },
  punk: {
    label: "Punk Zine", desc: "Fotocopie, spilli e giallo shock", fd: "'Special Elite', cursive", fb: "'Courier Prime', monospace", r: 0,
    status: { dark: ["#FFE600", "#FF2E88", "#3DDCFF", "#7CFF4F"], light: ["#8A7B00", "#C4005E", "#00789C", "#2E8A0A"] },
    dark: { bg: "repeating-linear-gradient(45deg,#121212 0 22px,#161616 22px 44px)", panel: "rgba(255,255,255,.04)", card: "#1C1C1C", text: "#F4F4F4", sub: "#ABABAB", faint: "#6E6E6E", border: "rgba(255,230,0,.35)", chip: "rgba(255,255,255,.09)", grad: "linear-gradient(90deg,#FFE600,#FFE600)", logoGrad: "linear-gradient(90deg,#FFE600,#FF2E88)", gradText: "#111" },
    light: { bg: "repeating-linear-gradient(45deg,#F2F0EA 0 22px,#ECEAE2 22px 44px)", panel: "rgba(20,20,20,.05)", card: "#FFFEF8", text: "#1A1A1A", sub: "#585858", faint: "#8E8E8E", border: "rgba(20,20,20,.55)", chip: "rgba(20,20,20,.08)", grad: "linear-gradient(90deg,#1A1A1A,#1A1A1A)", logoGrad: "linear-gradient(90deg,#1A1A1A,#C4005E)", gradText: "#FFE600" },
  },
  chip: {
    label: "8-Bit", desc: "Chiptune e pixel anni '80", fd: "'VT323', monospace", fb: "'VT323', monospace", r: 0,
    status: { dark: ["#FFD23F", "#FF5DB1", "#41E0E0", "#6CF06C"], light: ["#8F6E00", "#C1257E", "#0C7F7F", "#1F7F1F"] },
    dark: { bg: "linear-gradient(180deg,#0A0A2E,#12123F)", panel: "rgba(108,240,108,.05)", card: "#15154A", text: "#DFFFE0", sub: "#8FBF9F", faint: "#5E8A6E", border: "rgba(108,240,108,.30)", chip: "rgba(108,240,108,.10)", grad: "linear-gradient(90deg,#6CF06C,#41E0E0)", logoGrad: "linear-gradient(90deg,#6CF06C,#FFD23F)", gradText: "#0A0A2E" },
    light: { bg: "#E8F2E4", panel: "rgba(10,60,30,.05)", card: "#F8FFF4", text: "#12351E", sub: "#3F6B4E", faint: "#7BA58A", border: "rgba(18,53,30,.35)", chip: "rgba(18,53,30,.08)", grad: "linear-gradient(90deg,#1F7F1F,#0C7F7F)", logoGrad: "linear-gradient(90deg,#1F7F1F,#8F6E00)", gradText: "#F2FFEE" },
  },
  techno: {
    label: "Techno Club", desc: "Monocromo industriale + acido", fd: "'IBM Plex Mono', monospace", fb: "'IBM Plex Mono', monospace", r: 3,
    status: { dark: ["#B6FF2E", "#E8E8E8", "#8A8A8A", "#B6FF2E"], light: ["#4E7A00", "#2B2B2B", "#6E6E6E", "#4E7A00"] },
    dark: { bg: "repeating-linear-gradient(90deg, rgba(182,255,46,.03) 0 1px, transparent 1px 80px), #0D0D0D", panel: "rgba(255,255,255,.03)", card: "#161616", text: "#EDEDED", sub: "#8F8F8F", faint: "#5A5A5A", border: "rgba(182,255,46,.22)", chip: "rgba(255,255,255,.06)", grad: "linear-gradient(90deg,#B6FF2E,#8FE000)", logoGrad: "linear-gradient(90deg,#EDEDED 30%,#B6FF2E)", gradText: "#0D0D0D" },
    light: { bg: "#F1F1F1", panel: "rgba(0,0,0,.04)", card: "#FBFBFB", text: "#151515", sub: "#5C5C5C", faint: "#969696", border: "rgba(78,122,0,.35)", chip: "rgba(0,0,0,.06)", grad: "linear-gradient(90deg,#4E7A00,#365500)", logoGrad: "linear-gradient(90deg,#151515 30%,#4E7A00)", gradText: "#F5FFDE" },
  },
};
