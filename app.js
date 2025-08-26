(() => {
  const els = {
    gridSize: document.getElementById("gridSize"),
    cellSize: document.getElementById("cellSize"),
    strokeWidth: document.getElementById("strokeWidth"),
    showDots: document.getElementById("showDots"),
    build: document.getElementById("build"),
    clear: document.getElementById("clear"),
    invert: document.getElementById("invert"),
    stage: document.getElementById("stage"),
    exportBox: document.getElementById("exportBox"),
    download: document.getElementById("download"),
  };

  let state = {
    rows: 0,
    cols: 0,
    cell: 40,
    stroke: 3,
    svg: null,
    dragging: false,
    dragMode: null,
  };

  function parseGridSize(text) {
    const m = text.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/);
    if (!m) return { cols: 10, rows: 10 };
    return { cols: parseInt(m[1]), rows: parseInt(m[2]) };
  }

  function buildGrid() {
    const { cols, rows } = parseGridSize(els.gridSize.value);
    const cell = +els.cellSize.value || 40;
    const stroke = +els.strokeWidth.value || 3;
    const showDots = els.showDots.checked;

    state.cols = cols;
    state.rows = rows;
    state.cell = cell;
    state.stroke = stroke;

    const width = cols * cell;
    const height = rows * cell;

    els.stage.innerHTML = "";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width + 20);
    svg.setAttribute("height", height + 20);
    svg.setAttribute("viewBox", `-10 -10 ${width + 20} ${height + 20}`);
    state.svg = svg;

    const gEdges = document.createElementNS(svg.namespaceURI, "g");
    const gDots = document.createElementNS(svg.namespaceURI, "g");

    // 水平線
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const line = makeEdge("h", r, c, c * cell, r * cell, (c + 1) * cell, r * cell);

        if (r === 0 || r === rows) {
          setBorder(line); // 外枠は確定
        }

        gEdges.appendChild(line);
      }
    }

    // 垂直線
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const line = makeEdge("v", r, c, c * cell, r * cell, c * cell, (r + 1) * cell);

        if (c === 0 || c === cols) {
          setBorder(line); // 外枠は確定
        }

        gEdges.appendChild(line);
      }
    }

    // ドット
    if (showDots) {
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const dot = document.createElementNS(svg.namespaceURI, "circle");
          dot.setAttribute("cx", c * cell);
          dot.setAttribute("cy", r * cell);
          dot.setAttribute("r", 2);
          dot.classList.add("dot");
          gDots.appendChild(dot);
        }
      }
    }

    svg.appendChild(gEdges);
    svg.appendChild(gDots);
    els.stage.appendChild(svg);

    updateExport();
  }

  function makeEdge(o, r, c, x1, y1, x2, y2) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("edge");
    line.dataset.o = o;
    line.dataset.r = r;
    line.dataset.c = c;
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);

    line.addEventListener("pointerdown", (e) => {
      if (line.classList.contains("locked")) return; // 外枠は編集禁止
      const willOn = !line.classList.contains("active");
      setEdge(line, willOn);
      state.dragging = true;
      state.dragMode = willOn;
      state.svg.setPointerCapture(e.pointerId);
    });

    state.svg?.addEventListener("pointermove", (e) => {
      if (!state.dragging) return;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".edge");
      if (target && target.ownerSVGElement === state.svg) {
        if (target.classList.contains("locked")) return;
        setEdge(target, state.dragMode);
      }
    });

    state.svg?.addEventListener("pointerup", (e) => {
      state.dragging = false;
      state.dragMode = null;
      updateExport();
    });

    return line;
  }

  function setBorder(line) {
    line.classList.add("active", "locked");
  }

  function setEdge(line, on) {
    if (on) line.classList.add("active");
    else line.classList.remove("active");
  }

  function forEachEdge(fn) {
    state.svg?.querySelectorAll(".edge").forEach(fn);
  }

  // -------------------
  // JSON出力の整形処理
  // -------------------
  function updateExport() {
    const H = Array.from({ length: state.rows + 1 }, () => Array(state.cols).fill(0));
    const V = Array.from({ length: state.rows }, () => Array(state.cols + 1).fill(0));

    forEachEdge((line) => {
      let on = line.classList.contains("active") ? 1 : 0;
      if (line.classList.contains("locked")) on = 1; // 外枠は強制的に1
      if (line.dataset.o === "h") H[line.dataset.r][line.dataset.c] = on;
      else V[line.dataset.r][line.dataset.c] = on;
    });

    const obj = { rows: state.rows, cols: state.cols, horizontals: H, verticals: V };
    els.exportBox.value = stringifyArrays(obj);
  }

  function stringifyArrays(obj) {
    let str = JSON.stringify(obj, null, 2);
    str = str.replace(/\[\s+([0-9,\s]+?)\s+\]/g, (match, p1) => `[${p1.replace(/\s+/g, '')}]`);
    return str;
  }

  // -------------------
  // ボタン処理
  // -------------------
  els.build.addEventListener("click", buildGrid);
  els.clear.addEventListener("click", () => {
    forEachEdge((line) => {
      if (!line.classList.contains("locked")) setEdge(line, false);
    });
    updateExport();
  });
  els.invert.addEventListener("click", () => {
    forEachEdge((line) => {
      if (!line.classList.contains("locked")) setEdge(line, !line.classList.contains("active"));
    });
    updateExport();
  });
  els.download.addEventListener("click", () => {
    const blob = new Blob([els.exportBox.value], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "map.json";
    a.click();
  });

  // 初期生成
  buildGrid();
})();
