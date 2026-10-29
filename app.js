const DIAS = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const STORAGE = "sistemagenda.v1";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a, b) => key(a) === key(b);

/* ---------- Datas ---------- */
// Segunda-feira da próxima semana (sempre estritamente depois de hoje).
function nextMonday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (8 - d.getDay()) % 7 || 7; // dom->1, seg->7, ter->6 ... sáb->2
  d.setDate(d.getDate() + diff);
  return d;
}
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const weekDates = (monday) => Array.from({ length: 6 }, (_, i) => addDays(monday, i)); // seg..sáb

function weekTitle(dates) {
  const a = dates[0], b = dates[5];
  if (a.getMonth() === b.getMonth()) return `Semana de ${pad(a.getDate())} à ${pad(b.getDate())} de ${MESES[b.getMonth()]}`;
  return `Semana de ${pad(a.getDate())} de ${MESES[a.getMonth()]} à ${pad(b.getDate())} de ${MESES[b.getMonth()]}`;
}

/* ---------- Estado ---------- */
let monday = nextMonday();
let store = {};
try { store = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch { store = {}; }

const blank = () => ({ days: {}, banners: {}, birthdays: [], notes: [] });
const week = () => { const w = (store[key(monday)] ||= blank()); w.banners ||= {}; return w; };
const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(store)); } catch {} };

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Render ---------- */
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e[k] = v;
  }
  kids.forEach((c) => e.append(c));
  return e;
}
const autosize = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };

function field(tag, value, placeholder, onChange, extra = {}) {
  const e = el(tag, { value: value || "", placeholder, ...extra });
  e.addEventListener("input", () => { onChange(e.value); save(); if (tag === "textarea") autosize(e); });
  if (tag === "textarea") requestAnimationFrame(() => autosize(e));
  return e;
}

function delBtn(onClick) {
  return el("button", { class: "del", title: "Remover", textContent: "✕", onclick: onClick });
}

function renderDays() {
  const root = $("days"); root.innerHTML = "";
  const today = new Date();
  weekDates(monday).forEach((date) => {
    const k = key(date);
    const list = (week().days[k] ||= []);
    const card = el("section", { class: "day" + (sameDay(date, today) ? " today" : "") + (list.length ? "" : " free") });
    card.append(el("h2", { class: "bar" }, el("span", { textContent: DIAS[date.getDay()] }), el("span", { class: "date", textContent: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}` })));

    const bn = week().banners;
    const banner = el("div", { class: "rows" });
    const drawBanner = () => {
      banner.innerHTML = "";
      if (bn[k] === undefined) return;
      banner.append(el("div", { class: "row note banner" },
        field("textarea", bn[k], "Aviso do dia — ex.: DIA DO PROFESSOR (DIA NÃO LETIVO)", (v) => (bn[k] = v), { rows: 1 }),
        delBtn(() => { delete bn[k]; save(); drawBanner(); })));
    };
    drawBanner();
    card.append(banner);

    const rows = el("div", { class: "rows" });
    const draw = () => {
      rows.innerHTML = "";
      card.classList.toggle("free", !list.length);
      list.forEach((item, i) => {
        const timeBox = el("div", { class: "time" },
          field("input", item.start, "08:00", (v) => (item.start = v), { type: "time" }),
          el("span", { textContent: "às" }),
          field("input", item.end, "17:00", (v) => (item.end = v), { type: "time" }));
        const row = el("div", { class: "row" },
          timeBox,
          field("textarea", item.text, "Participantes / Atividade — ex.: Joelso participa de reunião…", (v) => (item.text = v), { rows: 1 }),
          field("textarea", item.place, "Local (digite livremente)", (v) => (item.place = v), { className: "loc", rows: 1 }),
          delBtn(() => { list.splice(i, 1); save(); draw(); }));
        rows.append(row);
      });
    };
    draw();

    card.append(rows, el("button", {
      class: "add no-print", textContent: "+ Adicionar atividade",
      onclick: () => { list.push({ start: "", end: "", text: "", place: "" }); save(); draw(); rows.lastChild.querySelector("textarea").focus(); },
    }), el("button", {
      class: "add no-print subtle", textContent: "+ Aviso do dia (ex.: dia não letivo)",
      onclick: () => { if (bn[k] === undefined) bn[k] = ""; save(); drawBanner(); banner.querySelector("textarea").focus(); },
    }));
    root.append(card);
  });
}

function renderBirthdays() {
  const root = $("birthdays"); root.innerHTML = "";
  const w = week();
  const dates = weekDates(monday).concat(addDays(monday, 6)); // inclui domingo
  w.birthdays.forEach((b, i) => {
    const sel = el("select");
    sel.append(el("option", { value: "", textContent: "Dia…" }));
    dates.forEach((d) => sel.append(el("option", { value: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`, textContent: `${pad(d.getDate())}.${pad(d.getMonth() + 1)} (${DIAS[d.getDay()].split("-")[0].toLowerCase()})` })));
    sel.value = b.day || "";
    sel.addEventListener("change", () => { b.day = sel.value; save(); });
    root.append(el("div", { class: "row simple" }, sel,
      field("input", b.name, "NOME DO ANIVERSARIANTE", (v) => (b.name = v.toUpperCase())),
      delBtn(() => { w.birthdays.splice(i, 1); save(); renderBirthdays(); })));
  });
}

function renderNotes() {
  const root = $("notes"); root.innerHTML = "";
  const w = week();
  w.notes.forEach((n, i) => {
    root.append(el("div", { class: "row note" },
      field("textarea", n.text, "Ex.: Fulano entra em férias de 10.11 à 20.11, retornando dia 21.11", (v) => (n.text = v), { rows: 1 }),
      delBtn(() => { w.notes.splice(i, 1); save(); renderNotes(); })));
  });
}

function render() {
  const dates = weekDates(monday);
  const title = weekTitle(dates);
  $("weekLabel").textContent = title;
  $("printWeek").textContent = title;
  const isNext = sameDay(monday, nextMonday());
  const diff = Math.round((monday - nextMonday()) / (7 * 864e5));
  $("weekHint").textContent = isNext ? "Próxima semana"
    : diff > 0 ? `${diff} semana(s) após a próxima` : `${-diff} semana(s) antes da próxima`;
  $("goNext").style.visibility = isNext ? "hidden" : "visible";
  renderDays(); renderBirthdays(); renderNotes();
}

/* ---------- Texto para copiar ---------- */
function asText() {
  const w = week(), dates = weekDates(monday);
  const out = ["AGENDA SEMANAL", weekTitle(dates), ""];
  dates.forEach((d) => {
    out.push(`${pad(d.getDate())} - ${DIAS[d.getDay()]}`);
    (w.days[key(d)] || []).forEach((i) => {
      const h = i.start ? `${i.start}${i.end ? " às " + i.end : ""}` : "";
      out.push(`  ${h} ${i.text}${i.place ? " — " + i.place : ""}`.replace(/\s+/g, " ").replace(/^ /, "  "));
    });
    out.push("");
  });
  if (w.birthdays.length) { out.push("ANIVERSARIANTES"); w.birthdays.forEach((b) => out.push(`  ${b.day} ${b.name}`)); out.push(""); }
  if (w.notes.length) { out.push("OBSERVAÇÕES"); w.notes.forEach((n) => out.push(`  ${n.text}`)); }
  return out.join("\n");
}

/* ---------- Eventos ---------- */
$("prevWeek").onclick = () => { monday = addDays(monday, -7); render(); };
$("nextWeek").onclick = () => { monday = addDays(monday, 7); render(); };
$("goNext").onclick = () => { monday = nextMonday(); render(); };
$("addBirthday").onclick = () => { week().birthdays.push({ day: "", name: "" }); save(); renderBirthdays(); };
$("addNote").onclick = () => { week().notes.push({ text: "" }); save(); renderNotes(); };
$("btnPrint").onclick = () => window.print();
$("btnCopy").onclick = async () => {
  try { await navigator.clipboard.writeText(asText()); toast("Agenda copiada!"); }
  catch { toast("Não foi possível copiar."); }
};
$("btnClear").onclick = () => {
  if (!confirm("Limpar todos os dados desta semana?")) return;
  delete store[key(monday)]; save(); render(); toast("Semana limpa.");
};

/* ---------- Exportação (layout igual ao modelo SENAI) ---------- */
const BLUE = [27, 74, 155], LIGHT = [181, 200, 234], ORANGE = [240, 125, 45];

// "08:00" -> "08h"; "13:30" -> "13:30h"
const fmtTime = (t) => (t ? (t.endsWith(":00") ? t.slice(0, 2) + "h" : t + "h") : "");

function collect() {
  const w = week(), dates = weekDates(monday);
  const days = dates.map((d) => ({
    label: `${pad(d.getDate())} - ${DIAS[d.getDay()]}`, banner: (w.banners || {})[key(d)] || "",
    items: (w.days[key(d)] || []).filter((i) => i.text || i.start || i.place).map((i) => ({
      time: i.start ? `${fmtTime(i.start)}${i.end ? " às " + fmtTime(i.end) : ""}` : "", text: i.text, place: i.place,
    })),
  }));
  return {
    title: weekTitle(dates), days,
    birthdays: w.birthdays.filter((b) => b.name), notes: w.notes.filter((n) => n.text),
    file: `agenda-semanal_${key(monday)}`,
  };
}

function saveBlob(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- PDF ---------- */
function exportPdf() {
  const d = collect();
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  // geometria medida no modelo (A4): moldura azul 185mm, conteúdo 178mm
  const FX = 13.5, FW = 185, FY = 20.5, IN = 3.5, TX = FX + IN, TW = FW - 2 * IN, FB = 297 - FY;
  const noLine = { lineWidth: 0 };
  const bar = { ...noLine, fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle", fontSize: 6.8, minCellHeight: 3.2, cellPadding: 0.4 };
  const orange = { ...noLine, fillColor: ORANGE, textColor: 0, fontStyle: "bold", halign: "center", valign: "middle", fontSize: 7.5, minCellHeight: 7, cellPadding: 0.6 };
  const big = { fontStyle: "bold", halign: "center", valign: "middle", fontSize: 10, minCellHeight: 7 };
  const hs = { fillColor: 255, textColor: 0, fontStyle: "bold", halign: "center", fontSize: 7, minCellHeight: 3.8, cellPadding: 0.5 };
  const head = ["Horário", "Participantes / Atividades", "Local"].map((c) => ({ content: c, styles: hs }));

  const body = [];
  d.days.forEach((day) => {
    body.push([{ content: day.label, colSpan: 3, styles: bar }]);
    if (day.banner) body.push([{ content: day.banner, colSpan: 3, styles: orange }]);
    (day.items.length ? day.items : [{ time: "", text: "", place: "" }]).forEach((i) => body.push([i.time, i.text, i.place]));
  });
  body.push([{ content: "DIA", styles: bar }, { content: "ANIVERSARIANTES", colSpan: 2, styles: bar }]);
  (d.birthdays.length ? d.birthdays : [{ day: "", name: "" }]).forEach((b) =>
    body.push([{ content: b.day, styles: big }, { content: b.name, colSpan: 2, styles: big }]));
  body.push([{ content: "OBSERVAÇÕES", colSpan: 3, styles: bar }]);
  (d.notes.length ? d.notes : [{ text: "" }]).forEach((n) => body.push([{ content: n.text, colSpan: 3, styles: big }]));

  const drawFrame = (page) => {
    doc.setFillColor(...BLUE);
    if (page === 1) {
      doc.rect(FX, FY, FW, IN + 15.4 + IN, "F");
      doc.setFillColor(255, 255, 255); doc.rect(TX, FY + IN, TW, 15.4, "F");
      if (typeof LOGO !== "undefined") doc.addImage("data:image/png;base64," + LOGO.b64, "PNG", TX + 3, FY + IN + 0.9, 52, 52 * LOGO.h / LOGO.w);
      else { doc.setFont("helvetica", "bolditalic"); doc.setFontSize(26); doc.setTextColor(...BLUE); doc.text("SENAI", TX + 4, FY + IN + 11); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0);
      doc.text("AGENDA SEMANAL", 105, FY + IN + 8.6, { align: "center" });
      doc.setFillColor(...LIGHT); doc.setDrawColor(...BLUE); doc.setLineWidth(0.25);
      doc.rect(139.5, FY + IN + 2.2, 52, 10.4, "FD");
      doc.setFont("helvetica", "bolditalic"); doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(d.title, 48);
      doc.text(lines, 165.5, FY + IN + 8.3 - (lines.length - 1) * 1.7, { align: "center", lineHeightFactor: 1.15 });
    } else {
      doc.rect(FX, FY, FW, IN, "F");
    }
    doc.setFillColor(...BLUE);
    doc.rect(FX, FY, IN, FB - FY, "F"); doc.rect(FX + FW - IN, FY, IN, FB - FY, "F"); doc.rect(FX, FB - IN, FW, IN, "F");
    doc.setDrawColor(0); doc.setTextColor(0);
  };

  doc.autoTable({
    startY: FY + IN + 15.4 + IN, margin: { left: TX, right: 210 - TX - TW, top: FY + IN, bottom: 297 - FB + IN },
    head: [head], body, theme: "plain", tableWidth: TW,
    styles: { font: "helvetica", fontSize: 7.5, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: { top: 0.8, bottom: 0.8, left: 0.9, right: 0.9 }, minCellHeight: 7, valign: "middle" },
    columnStyles: { 0: { cellWidth: 24, halign: "center", fontSize: 7 }, 1: { cellWidth: 97 }, 2: { cellWidth: 57, halign: "center", fontSize: 9 } },
    didDrawPage: (data) => drawFrame(data.pageNumber),
  });

  // fecha a moldura logo abaixo da última linha
  const y = doc.lastAutoTable.finalY;
  doc.setFillColor(255, 255, 255); doc.rect(FX - 1, y + IN, FW + 2, 297 - y, "F");
  doc.setFillColor(...BLUE); doc.rect(FX, y, FW, IN, "F");
  doc.save(d.file + ".pdf");
}

/* ---------- Excel (ExcelJS: estilos, moldura azul e logo) ---------- */
async function exportXlsx() {
  const d = collect();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Agenda Semanal", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 2.5 }, { width: 17 }, { width: 72 }, { width: 40 }, { width: 2.5 }];

  const BLUE_ARGB = "FF1B4A9B", WHITE = "FFFFFFFF", LIGHT_ARGB = "FFB5C8EA", ORANGE_ARGB = "FFF07D2D";
  const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const thin = { style: "thin", color: { argb: "FF000000" } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const font = (o = {}) => ({ name: "Arial", size: o.size || 9, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || "FF000000" } });
  const align = (h = "left") => ({ vertical: "middle", horizontal: h, wrapText: true });

  // linha com as bordas azuis (colunas A e E); full = linha toda azul
  const newRow = (height, full = false) => {
    const row = ws.addRow([]);
    row.height = height;
    for (let c = 1; c <= 5; c++) if (full || c === 1 || c === 5) row.getCell(c).fill = fill(BLUE_ARGB);
    return row;
  };
  // estiliza as colunas B..D de uma linha
  const style = (row, o) => {
    for (let c = 2; c <= 4; c++) {
      const cell = row.getCell(c);
      if (o.fill) cell.fill = fill(o.fill);
      if (o.border) cell.border = box;
      cell.font = font(o.font);
      cell.alignment = align(o.h);
    }
  };
  const lines = (text, perLine) => String(text || "").split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  const heightFor = (...ls) => Math.max(24, Math.max(...ls) * 12 + 8);

  // cabeçalho: logo | título | semana
  newRow(8, true);
  const h1 = newRow(26), h2 = newRow(26);
  [h1, h2].forEach((r) => style(r, { fill: WHITE }));
  ws.mergeCells("B2:B3"); ws.mergeCells("C2:C3"); ws.mergeCells("D2:D3");
  ws.getCell("C2").value = "AGENDA SEMANAL"; ws.getCell("C2").font = font({ bold: true, size: 10 }); ws.getCell("C2").alignment = align("center");
  ws.getCell("D2").value = d.title; ws.getCell("D2").font = font({ bold: true, italic: true, size: 11 }); ws.getCell("D2").alignment = align("center");
  [h1, h2].forEach((r) => { r.getCell(4).fill = fill(LIGHT_ARGB); r.getCell(4).border = box; });
  if (typeof LOGO !== "undefined") {
    const id = wb.addImage({ base64: LOGO.b64, extension: "png" });
    ws.addImage(id, { tl: { col: 1.04, row: 1.15 }, ext: { width: 180, height: (180 * LOGO.h) / LOGO.w } });
  }
  newRow(8, true);

  // cabeçalho da tabela
  const th = newRow(16);
  ["Horário", "Participantes / Atividades", "Local"].forEach((t, i) => (th.getCell(i + 2).value = t));
  style(th, { fill: WHITE, border: true, font: { bold: true }, h: "center" });

  const bar = (text) => {
    const r = newRow(14);
    r.getCell(2).value = text;
    style(r, { fill: BLUE_ARGB, font: { bold: true, color: WHITE, size: 8 }, h: "center" });
    ws.mergeCells(r.number, 2, r.number, 4);
  };
  d.days.forEach((day) => {
    bar(day.label);
    if (day.banner) {
      const r = newRow(heightFor(lines(day.banner, 110)));
      r.getCell(2).value = day.banner;
      style(r, { fill: ORANGE_ARGB, font: { bold: true, size: 10 }, h: "center" });
      ws.mergeCells(r.number, 2, r.number, 4);
    }
    (day.items.length ? day.items : [{ time: "", text: "", place: "" }]).forEach((i) => {
      const r = newRow(heightFor(lines(i.text, 80), lines(i.place, 34)));
      r.getCell(2).value = i.time; r.getCell(3).value = i.text; r.getCell(4).value = i.place;
      style(r, { fill: WHITE, border: true });
      r.getCell(2).alignment = align("center"); r.getCell(2).font = font({ size: 9 });
      r.getCell(4).alignment = align("center"); r.getCell(4).font = font({ size: 11 });
    });
  });

  // aniversariantes
  const bh = newRow(14);
  bh.getCell(2).value = "DIA"; bh.getCell(3).value = "ANIVERSARIANTES";
  style(bh, { fill: BLUE_ARGB, font: { bold: true, color: WHITE, size: 8 }, h: "center" });
  ws.mergeCells(bh.number, 3, bh.number, 4);
  (d.birthdays.length ? d.birthdays : [{ day: "", name: "" }]).forEach((b) => {
    const r = newRow(24);
    r.getCell(2).value = b.day; r.getCell(3).value = b.name;
    style(r, { fill: WHITE, border: true, font: { bold: true, size: 12 }, h: "center" });
    ws.mergeCells(r.number, 3, r.number, 4);
  });

  // observações
  bar("OBSERVAÇÕES");
  (d.notes.length ? d.notes : [{ text: "" }]).forEach((n) => {
    const r = newRow(heightFor(lines(n.text, 95)));
    r.getCell(2).value = n.text;
    style(r, { fill: WHITE, border: true, font: { bold: true, size: 12 }, h: "center" });
    ws.mergeCells(r.number, 2, r.number, 4);
  });
  newRow(8, true);

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), d.file + ".xlsx");
}

/* ---------- Word ---------- */
function exportDoc() {
  const d = collect();
  const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).replace(/\n/g, "<br>");
  const cell = (t, extra = "") => `<td ${extra} style="border:1px solid #000;padding:4px;font-size:9pt">${t || "&nbsp;"}</td>`;
  const bar = (inner, span = "") => `<td ${span} bgcolor="#1B4A9B" align="center" style="border:1px solid #000;padding:2px;color:#fff;font-size:9pt"><b>${inner}</b></td>`;
  let rows = `<tr><td align="center" style="border:1px solid #000;padding:3px;font-size:9pt"><b>Horário</b></td><td align="center" style="border:1px solid #000;padding:3px;font-size:9pt"><b>Participantes / Atividades</b></td><td align="center" style="border:1px solid #000;padding:3px;font-size:9pt"><b>Local</b></td></tr>`;
  d.days.forEach((day) => {
    rows += `<tr>${bar(esc(day.label), 'colspan="3"')}</tr>`;
    if (day.banner) rows += `<tr style="height:24pt"><td colspan="3" bgcolor="#F07D2D" align="center" style="border:1px solid #000;font-size:10pt"><b>${esc(day.banner)}</b></td></tr>`;
    (day.items.length ? day.items : [{ time: "", text: "", place: "" }]).forEach((i) =>
      (rows += `<tr style="height:20pt">${cell(esc(i.time), 'align="center"')}${cell(esc(i.text))}${cell(esc(i.place), 'align="center"')}</tr>`));
  });
  rows += `<tr>${bar("DIA")}${bar("ANIVERSARIANTES", 'colspan="2"')}</tr>`;
  (d.birthdays.length ? d.birthdays : [{ day: "", name: "" }]).forEach((b) =>
    (rows += `<tr style="height:20pt">${cell(`<b>${esc(b.day)}</b>`, 'align="center"')}${cell(`<b>${esc(b.name)}</b>`, 'colspan="2" align="center"')}</tr>`));
  rows += `<tr>${bar("OBSERVAÇÕES", 'colspan="3"')}</tr>`;
  (d.notes.length ? d.notes : [{ text: "" }]).forEach((n) =>
    (rows += `<tr style="height:20pt">${cell(`<b>${esc(n.text)}</b>`, 'colspan="3" align="center"')}</tr>`));

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Agenda Semanal</title>
<style>@page Section1 { size: 21cm 29.7cm; margin: 1cm; } div.Section1 { page: Section1; } body { font-family: Arial, sans-serif; }</style></head>
<body><div class="Section1">
<table width="100%" cellspacing="0" cellpadding="10" bgcolor="#1B4A9B" style="border-collapse:collapse"><tr><td bgcolor="#1B4A9B">
  <table width="100%" cellspacing="0" cellpadding="8" bgcolor="#FFFFFF" style="border-collapse:collapse"><tr>
    <td width="33%">${HAS_LOGO ? `<img src="file:///C:/logo.png" width="195" height="${Math.round((195 * LOGO.h) / LOGO.w)}">` : "<b style=\"font-size:26pt;color:#1B4A9B\">SENAI</b>"}</td>
    <td width="34%" align="center" style="font-size:10pt"><b>AGENDA SEMANAL</b></td>
    <td width="33%" align="center" bgcolor="#B5C8EA" style="border:1px solid #1B4A9B;font-size:10pt"><b><i>${esc(d.title)}</i></b></td>
  </tr></table>
  <p style="margin:0;font-size:4pt">&nbsp;</p>
  <table width="100%" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF" style="border-collapse:collapse;border:1px solid #000">
    <col width="13%"><col width="55%"><col width="32%">${rows}
  </table>
</td></tr></table></div></body></html>`;
  const wrap = (s) => s.replace(/.{1,76}/g, "$&\r\n");
  const htmlB64 = btoa(unescape(encodeURIComponent(html)));
  const mht = [
    "MIME-Version: 1.0", 'Content-Type: multipart/related; boundary="----=_SENAI"; type="text/html"', "",
    "------=_SENAI", 'Content-Type: text/html; charset="utf-8"', "Content-Transfer-Encoding: base64", "Content-Location: file:///C:/agenda.htm", "",
    wrap(htmlB64),
    "------=_SENAI", "Content-Type: image/png", "Content-Transfer-Encoding: base64", "Content-Location: file:///C:/logo.png", "",
    HAS_LOGO ? wrap(LOGO.b64) : "",
    "------=_SENAI--", "",
  ].join("\r\n");
  saveBlob(new Blob([mht], { type: "application/msword" }), d.file + ".doc");
}

const HAS_LOGO = typeof LOGO !== "undefined";
const exporters = { pdf: [exportPdf, "jspdf"], xlsx: [exportXlsx, "ExcelJS"], doc: [exportDoc, null] };
$("btnDownload").onclick = (e) => { e.stopPropagation(); $("dlMenu").classList.toggle("open"); };
document.addEventListener("click", () => $("dlMenu").classList.remove("open"));
document.querySelectorAll(".menu-list button").forEach((b) => (b.onclick = async () => {
  const [fn, lib] = exporters[b.dataset.fmt];
  if (lib && !window[lib]) return toast("Biblioteca não carregada. Verifique a internet.");
  try { await fn(); toast("Arquivo gerado!"); } catch (err) { console.error(err); toast("Erro ao gerar o arquivo."); }
}));

render();
