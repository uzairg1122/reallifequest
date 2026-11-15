import {Capacitor, registerPlugin} from '@capacitor/core';
import sunrise from '../assets/parent-redesign/sunrise-header.png';
import journal from '../assets/parent-redesign/icons/family-journal.png';
import type {FamilyShare} from './api';

const native = registerPlugin<{
  shareImage(input: {data: string}): Promise<void>;
  saveImage(input: {data: string}): Promise<{saved: boolean; gallery?: boolean}>;
}>('QuestNavigation');

async function loadArt(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export async function makeProgressCard(data: FamilyShare, translate: (text: string) => string, locale: string) {
  const [sky, badge] = await Promise.all([loadArt(sunrise), loadArt(journal)]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create your image.');
  const panel = (x: number, y: number, width: number, height: number, radius: number, color: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const text = (value: string, x: number, y: number, size: number, color = '#142d40', max = 920) => {
    ctx.fillStyle = color;
    ctx.font = '700 ' + size + 'px system-ui, sans-serif';
    ctx.fillText(value, x, y, max);
  };

  ctx.fillStyle = '#edf5f6';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(32, 32, 1016, 1016, 54);
  ctx.clip();
  ctx.fillStyle = '#fffcf3';
  ctx.fillRect(32, 32, 1016, 1016);
  const scale = Math.max(1016 / sky.width, 515 / sky.height);
  ctx.drawImage(sky, (1080 - sky.width * scale) / 2, 32, sky.width * scale, sky.height * scale);
  const fade = ctx.createLinearGradient(0, 200, 0, 548);
  fade.addColorStop(0, '#fffcf300');
  fade.addColorStop(1, '#fffcf3');
  ctx.fillStyle = fade;
  ctx.fillRect(32, 200, 1016, 848);
  ctx.restore();

  ctx.textAlign = 'center';
  panel(344, 79, 392, 64, 32, '#ffffffd9');
  text('SUPER TASKER', 540, 121, 30, '#214958');
  ctx.drawImage(badge, 416, 150, 248, 248);
  text(translate('Family progress'), 540, 452, 76);
  text(data.theme.title, 540, 524, 40, '#40616c');
  const format = new Intl.NumberFormat(locale);
  const stats = [
    [format.format(data.totals.xp), translate('Total XP')],
    [format.format(data.totals.stars), translate('Stars')],
    [format.format(data.totals.children), translate(data.totals.children === 1 ? 'Hero' : 'Heroes')],
  ];
  stats.forEach(([value, label], index) => {
    const x = 89 + index * 306;
    panel(x, 586, 290, 198, 34, ['#d9edf8', '#fff0c6', '#e0f1e6'][index]);
    text(value, x + 145, 689, 70, '#142d40', 246);
    text(label, x + 145, 746, 34, '#32545f', 246);
  });
  panel(89, 836, 902, 153, 38, '#173746');
  text(translate('Join us with code'), 540, 891, 32, '#cce5e9');
  text(data.referralCode, 540, 958, 56, '#ffe4a1', 806);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Could not create your image.')),
    'image/png',
  ));
}

function readData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const filename = 'real-life-quest-progress.png';

export async function shareProgressCard(blob: Blob) {
  if (Capacitor.getPlatform() === 'android') {
    await native.shareImage({data: await readData(blob)});
    return;
  }
  const file = new File([blob], filename, {type: 'image/png'});
  if (!navigator.canShare?.({files: [file]})) {
    throw new Error('Image sharing is unavailable here. Use Save image to download the card.');
  }
  await navigator.share({files: [file], title: 'Super Tasker'});
}

export async function saveProgressCard(blob: Blob) {
  if (Capacitor.getPlatform() === 'android') {
    const {saved, gallery} = await native.saveImage({data: await readData(blob)});
    return saved ? gallery ? 'Saved to Pictures / Super Tasker.' : 'Image saved.' : '';
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'Image download started.';
}
