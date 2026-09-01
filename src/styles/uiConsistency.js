import { font, warna, radius, bayangan, teks } from "./theme";

export const uiCard = {
  background: warna.panel,
  border: `1px solid ${warna.garis}`,
  borderRadius: radius.besar,
  boxShadow: bayangan,
};

export const uiTable = {
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: font.display,
};

export const uiTh = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: teks.kecil,
  fontWeight: 700,
  lineHeight: 1.35,
  color: warna.tintaSamar,
  background: warna.panelAlt,
  borderBottom: `1px solid ${warna.garis}`,
};

export const uiTd = {
  padding: "13px 14px",
  fontSize: teks.badan,
  lineHeight: 1.45,
  color: warna.tinta,
  borderBottom: `1px solid ${warna.garis}`,
  verticalAlign: "middle",
};

export const uiBackButton = {
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 12px",
  border: `1px solid ${warna.garis}`,
  borderRadius: radius.sedang,
  background: warna.panel,
  color: warna.tintaLembut,
  boxShadow: "0 1px 2px rgba(22,35,61,0.03)",
  fontFamily: font.display,
  fontSize: teks.badan,
  fontWeight: 600,
  cursor: "pointer",
};
