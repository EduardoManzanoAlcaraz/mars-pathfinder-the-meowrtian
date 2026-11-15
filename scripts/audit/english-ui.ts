import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';

// Regression inventory from the former Spanish UI, including accessible names.
const spanishUI = /[¿¡áéíóúñ]|\b(?:planificador|fuentes|método|preparando|verificando|verificado|origen|destino|calcular|calculando|reiniciar|cancelar|ortoimagen|relieve|elevación|pendiente|mostrar|ocultar|celda|malla|ficha|geología|desfase|opacidad|objetivos|fotografías|consultar|cerrar|ajuste|altura|créditos|selecciona|seleccionar|terreno|coordenadas|sin datos|no se|no es|de la|del rover|y descripción)\b/i;
export async function assertEnglishUI(page: Page): Promise<void> {
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  const strings = await page.evaluate(() => {
    const values = [document.body.innerText];
    for (const element of document.querySelectorAll('[aria-label],[title],[alt]')) {
      if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
      for (const attr of ['aria-label', 'title', 'alt']) {
        const value = element.getAttribute(attr); if (value) values.push(value);
      }
    }
    return values;
  });
  for (const value of strings) assert.ok(!spanishUI.test(value), `Untranslated UI copy: ${value.match(spanishUI)?.[0]}`);
  const clipped = await page.locator('.metrics-table td').evaluateAll(cells => cells
    .filter(cell => cell.scrollWidth > cell.clientWidth + 1).map(cell => cell.textContent));
  assert.deepEqual(clipped, [], 'Translated metric values and units must fit each table cell');
}
