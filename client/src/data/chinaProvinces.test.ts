// The bundled admin-1 dataset (server/assets/atlas/admin1.geojson.gz) is the
// source of the region layer's Chinese-name matching (useAtlas.ts →
// getProvinceNameByEnglish). Every `name` below is copied verbatim from that
// dataset's CN features, so any change to either side that breaks matching
// fails here instead of silently falling back to English tooltips.
import { describe, expect, it } from 'vitest';
import { CHINA_PROVINCES, getProvinceNameByEnglish } from './chinaProvinces';

/** name = name_en in the dataset; admin is 'China' for all 34 features. */
const DATASET_NAMES: Array<[string, string]> = [
  ['Anhui Province', '安徽省'],
  ['Beijing Municipality', '北京市'],
  ['Chongqing Municipality', '重庆市'],
  ['Fujian Province', '福建省'],
  ['Gansu Province', '甘肃省'],
  ['Guangxi Zhuang Autonomous Region', '广西壮族自治区'],
  // Dataset typo: Guangdong labelled as "Guangzhou Province".
  ['Guangzhou Province', '广东省'],
  ['Guizhou Province', '贵州省'],
  ['Hainan Province', '海南省'],
  ['Hebei Province', '河北省'],
  ['Heilongjiang Province', '黑龙江省'],
  ['Henan Province', '河南省'],
  ['Hong Kong Special Administrative Region', '香港特别行政区'],
  ['Hubei Province', '湖北省'],
  ['Hunan Province', '湖南省'],
  ['Inner Mongolia Autonomous Region', '内蒙古自治区'],
  ['Jiangsu Province', '江苏省'],
  ['Jiangxi Province', '江西省'],
  ['Jilin Province', '吉林省'],
  ['Liaoning Province', '辽宁省'],
  ['Macau Special Administrative Region', '澳门特别行政区'],
  // Dataset typo: "Ningxia" duplicated before the formal name.
  ['Ningxia Ningxia Hui Autonomous Region', '宁夏回族自治区'],
  ['Qinghai Province', '青海省'],
  ['Shaanxi Province', '陕西省'],
  ['Shandong Province', '山东省'],
  ['Shanghai Municipality', '上海市'],
  ['Shanxi Province', '山西省'],
  ['Sichuan Province', '四川省'],
  ['Taiwan Province', '台湾省'],
  ['Tianjin Municipality', '天津市'],
  ['Tibet Autonomous Region', '西藏自治区'],
  ['Xinjiang Uyghur Autonomous Region', '新疆维吾尔自治区'],
  ['Yunnan Province', '云南省'],
  ['Zhejiang Province', '浙江省'],
];

describe('getProvinceNameByEnglish', () => {
  it('maps every admin1.geojson.gz CN feature name to its Chinese province name', () => {
    for (const [datasetName, expected] of DATASET_NAMES) {
      expect(getProvinceNameByEnglish(datasetName), datasetName).toBe(expected);
    }
  });

  it('covers every province in CHINA_PROVINCES — no orphan the tooltip would leave English', () => {
    const resolved = new Set(DATASET_NAMES.map(([, chinese]) => chinese));
    for (const province of Object.values(CHINA_PROVINCES)) {
      expect(resolved.has(province.name), province.name).toBe(true);
    }
  });

  it('still resolves short names and is null-safe', () => {
    expect(getProvinceNameByEnglish('Beijing')).toBe('北京市');
    expect(getProvinceNameByEnglish('Guangdong')).toBe('广东省');
    expect(getProvinceNameByEnglish('Inner Mongolia')).toBe('内蒙古自治区');
    expect(getProvinceNameByEnglish('')).toBeNull();
    expect(getProvinceNameByEnglish('Atlantis')).toBeNull();
  });
});
