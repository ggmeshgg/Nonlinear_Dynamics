import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'pipe' });
const url = process.env.CHECK_URL || 'http://127.0.0.1:4173/rlc-interactive-lecture/';
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{} await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('.js-plotly-plot').first().waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.js-plotly-plot .main-svg').length>=3);
  assert.equal(await page.locator('main > section').count(),10);
  assert.equal(await page.locator('.katex-error').count(),0);
  assert.ok(await page.locator('.katex').count()>30);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/desktop.png'});
  await page.getByRole('button',{name:/Открыть интерактивную модель/}).click();
  await page.screenshot({path:'test-results/model.png'});
  const fill = async (id,value) => { await page.locator(id).fill(String(value)); await page.locator(id).blur(); };
  for(const id of ['#L-number','#C-number']){ await fill(id,0); assert.match(await page.locator('#section-6').innerText(),/вырожденн/i); await page.getByRole('button',{name:'Сброс',exact:true}).click(); }
  for(const name of ['Критическое затухание','Сильное затухание','Идеальный LC']){await page.getByRole('button',{name,exact:true}).click(); assert.doesNotMatch(await page.locator('#section-6').innerText(),/NaN|undefined|Infinity/);}
  await page.getByRole('button',{name:'Установить точный идеальный резонанс'}).click();
  assert.match(await page.locator('#section-6').innerText(),/амплитуда растёт/);
  await fill('#f-number',0);await fill('#Um-number',0);
  await page.locator('summary').click();await fill('#q0-number',1.2);await fill('#I0-number',0.5);
  await page.getByRole('button',{name:'Сброс',exact:true}).click();
  await fill('#L-number',50);await fill('#C-number',10);await fill('#f-number',20);await fill('#Um-number',200);
  assert.doesNotMatch(await page.locator('#section-6').innerText(),/NaN|undefined|Infinity/);
  await page.getByRole('button',{name:'Сброс',exact:true}).click();
  await page.locator('.contents a').first().click();await page.getByRole('button',{name:/Режим лекции/}).click();
  await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#section-1').isVisible());
  await page.keyboard.press('ArrowLeft');assert.ok(await page.locator('#section-0').isVisible());
  await page.keyboard.press('Escape');assert.ok(await page.locator('#section-6').isVisible());
  await page.setViewportSize({width:390,height:844});await page.goto(url);await page.locator('.js-plotly-plot').first().waitFor();
  await page.screenshot({path:'test-results/mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile page must not overflow horizontally');
  assert.deepEqual(errors,[]);console.log('Browser checks passed: plots, formulas, presets, edge values, lecture keys, mobile layout.');
} finally {await browser?.close();server.kill();}
