/* WebGL2 instanced glyph renderer.
 *
 * The whole screen is one draw call. A single unit quad is instanced once per
 * cell; the instance id gives the cell its column and row, so per-cell data is
 * only the glyph index and its colour. That keeps the per-frame upload at 4
 * floats per cell, which is what makes a ~12k cell field affordable at 60fps.
 *
 * Canvas 2D was the obvious first choice and does not survive the cell count:
 * a per-cell fillText or drawImage lands around 12k calls a frame, which is an
 * order of magnitude past budget. The HUD prints frame ms, so this is visible.
 */

import { buildAtlas, ATLAS_COLS, ATLAS_ROWS, ATLAS_CHARS } from './glyphs.js';

const VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 quad;      // unit quad, 0..1
layout(location = 1) in float aGlyph;   // atlas index
layout(location = 2) in vec3 aColor;

uniform vec2 uGrid;      // cols, rows
uniform vec2 uCell;      // cell size in clip-space units
uniform vec2 uAtlasGrid; // atlas cols, rows
uniform vec2 uOffset;    // sub-cell scroll, in cells

out vec2 vUv;
out vec3 vColor;

void main() {
  float col = mod(float(gl_InstanceID), uGrid.x);
  float row = floor(float(gl_InstanceID) / uGrid.x);

  /* A negative glyph index marks a cell pinned to the screen (the HUD, the
     sun) so the sub-cell scroll does not drag it along with the ground. The
     sign carries it because the alternative is a fifth float per cell, and
     the size of the per-cell upload is the whole reason this renderer
     exists. A blank cell is index 0 and draws nothing either way. */
  vec2 shift = aGlyph < 0.0 ? vec2(0.0) : uOffset;

  // Cell origin in clip space, top-left anchored.
  vec2 p = vec2(-1.0, 1.0) + vec2((col - shift.x) * uCell.x, -(row - shift.y) * uCell.y);
  p += vec2(quad.x * uCell.x, -quad.y * uCell.y);
  gl_Position = vec4(p, 0.0, 1.0);

  float g = floor(abs(aGlyph) + 0.5);
  vec2 cell = vec2(mod(g, uAtlasGrid.x), floor(g / uAtlasGrid.x));
  vUv = (cell + quad) / uAtlasGrid;

  vColor = aColor;
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
in vec3 vColor;
uniform sampler2D uAtlas;
out vec4 outColor;

void main() {
  float a = texture(uAtlas, vUv).a;
  if (a < 0.01) discard;
  outColor = vec4(vColor * a, a);
}`;

function compile(gl, type, src) {
	const sh = gl.createShader(type);
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		throw new Error('glyph shader: ' + gl.getShaderInfoLog(sh));
	}
	return sh;
}

export class GlyphRenderer {
	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {number} cellPx target cell width in CSS pixels
	 */
	constructor(canvas, cellPx = 11) {
		const gl = canvas.getContext('webgl2', {
			alpha: false,
			antialias: false,
			desynchronized: true,
			powerPreference: 'high-performance',
		});
		if (!gl) throw new Error('webgl2-unavailable');

		this.canvas = canvas;
		this.gl = gl;
		this.cellPx = cellPx;
		this.cols = 0;
		this.rows = 0;

		const prog = gl.createProgram();
		gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			throw new Error('glyph program: ' + gl.getProgramInfoLog(prog));
		}
		this.prog = prog;
		this.u = {
			grid: gl.getUniformLocation(prog, 'uGrid'),
			cell: gl.getUniformLocation(prog, 'uCell'),
			atlasGrid: gl.getUniformLocation(prog, 'uAtlasGrid'),
			atlas: gl.getUniformLocation(prog, 'uAtlas'),
			offset: gl.getUniformLocation(prog, 'uOffset'),
		};

		/* While set, cells are written pinned to the screen instead of to the
		   ground. draw() clears it every frame, so a caller that forgets to
		   put it back cannot drag the mistake into the next one. */
		this.pinned = false;

		this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);

		// Unit quad, two triangles.
		const quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
			gl.STATIC_DRAW,
		);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		// Per-instance: glyph index + rgb, interleaved.
		this.instBuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 0);
		gl.vertexAttribDivisor(1, 1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 16, 4);
		gl.vertexAttribDivisor(2, 1);

		gl.bindVertexArray(null);

		this.tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // atlas is premultiplied in the shader

		this.data = new Float32Array(0);
		this._w = 0;
		this._h = 0;
		this.resize();

		/* The canvas often has no layout yet when the renderer is constructed
		   (it is built behind an overlay, or the tab is still laying out), and
		   a window resize event never fires for that. Observing the element
		   itself is the only thing that catches the box arriving. */
		this._ro = new ResizeObserver(() => this.resize());
		this._ro.observe(this.canvas);
	}

	/** Stop observing. The caller owns the canvas, so nothing else is torn down. */
	dispose() {
		this._ro?.disconnect();
		this._ro = null;
	}

	/** Recompute the grid for the current canvas size and rebuild the atlas. */
	resize() {
		const gl = this.gl;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = this.canvas.clientWidth || window.innerWidth;
		const h = this.canvas.clientHeight || window.innerHeight;

		/* Rebuilding the atlas is the expensive part, so skip the whole pass
		   when nothing actually changed. ResizeObserver fires more often than
		   the size changes. */
		if (w === this._w && h === this._h) return;
		this._w = w;
		this._h = h;
		if (w === 0 || h === 0) return; // not laid out yet; the observer will call back

		this.canvas.width = Math.max(1, Math.floor(w * dpr));
		this.canvas.height = Math.max(1, Math.floor(h * dpr));

		const cw = this.cellPx;
		const chh = Math.round(this.cellPx * 1.75); // blade-ish cells, taller than wide
		/* One cell of margin on each axis: the sub-cell scroll slides the grid
		   up to a whole cell left and up, which would otherwise uncover a blank
		   strip along the right edge and the bottom. */
		this.cols = Math.max(1, Math.ceil(w / cw)) + 1;
		this.rows = Math.max(1, Math.ceil(h / chh)) + 1;
		this.cellW = cw;
		this.cellH = chh;

		const atlas = buildAtlas(Math.round(cw * dpr), Math.round(chh * dpr));
		gl.bindTexture(gl.TEXTURE_2D, this.tex);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

		const n = this.cols * this.rows;
		if (this.data.length !== n * 4) this.data = new Float32Array(n * 4);

		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	}

	/** Number of cells in the current grid. */
	get cellCount() {
		return this.cols * this.rows;
	}

	/** Clear every cell to blank. */
	clear() {
		this.data.fill(0);
	}

	/**
	 * Write one cell. Out-of-range writes are dropped, which lets callers
	 * draw entities without clipping them by hand.
	 */
	set(col, row, g, r, gr, b) {
		if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
		const i = (row * this.cols + col) * 4;
		const d = this.data;
		d[i] = this.pinned ? -g : g;
		d[i + 1] = r;
		d[i + 2] = gr;
		d[i + 3] = b;
	}

	/**
	 * Write a string left-to-right from (col,row).
	 * Colour is one [r,g,b] array rather than three arguments: every caller
	 * already holds an array, and passing one where three were expected wrote
	 * undefined into the buffer, which reaches the shader as NaN and corrupts
	 * the frame with nothing to see in the console.
	 */
	text(col, row, str, colour) {
		const [r, g, b] = colour;
		for (let i = 0; i < str.length; i++) {
			const idx = ATLAS_CHARS.indexOf(str[i]);
			if (idx > 0) this.set(col + i, row, idx, r, g, b);
		}
	}

	/**
	 * Upload the cell buffer and draw the frame.
	 *
	 * @param {number} fx sub-cell scroll in cells, 0..1. The grid is integral
	 *   and the camera is not, so the fraction slides the whole grid rather
	 *   than being rounded away, which is what stops the ground from jumping
	 *   a whole cell at a time.
	 */
	draw(bg = [0.027, 0.043, 0.035], fx = 0, fy = 0) {
		const gl = this.gl;
		this.pinned = false;
		gl.clearColor(bg[0], bg[1], bg[2], 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this.prog);
		gl.bindVertexArray(this.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
		gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);

		gl.uniform2f(this.u.grid, this.cols, this.rows);
		gl.uniform2f(
			this.u.cell,
			(this.cellW / (this._w || 1)) * 2,
			(this.cellH / (this._h || 1)) * 2,
		);
		gl.uniform2f(this.u.atlasGrid, ATLAS_COLS, ATLAS_ROWS);
		gl.uniform2f(this.u.offset, fx, fy);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.tex);
		gl.uniform1i(this.u.atlas, 0);

		gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.cellCount);
		gl.bindVertexArray(null);
	}
}
