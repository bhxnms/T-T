/**
 * China Province Data and Landmarks for TT Atlas
 * 中国省份数据和地标景点
 */

import type { LandmarkType } from '../utils/landmarkIcons';

export interface ProvinceLandmark {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  type: LandmarkType;
  description: string;
}

export interface ProvinceData {
  code: string; // Province code
  name: string; // Chinese name
  nameEn: string; // English name
  center: [number, number]; // [lat, lng]
  landmarks: ProvinceLandmark[];
}

/**
 * China provinces with representative landmarks
 * 中国各省份及代表性景点
 */
export const CHINA_PROVINCES: Record<string, ProvinceData> = {
  // 华北地区
  BJ: {
    code: 'BJ',
    name: '北京市',
    nameEn: 'Beijing',
    center: [39.9042, 116.4074],
    landmarks: [
      {
        name: '故宫',
        nameEn: 'Forbidden City',
        lat: 39.9163,
        lng: 116.3972,
        type: 'palace',
        description: '明清两代的皇家宫殿，世界文化遗产，中国古代宫廷建筑之精华。',
      },
      {
        name: '长城',
        nameEn: 'Great Wall',
        lat: 40.4319,
        lng: 116.5704,
        type: 'fortress',
        description: '世界七大奇迹之一，中国古代军事防御工程的杰作。',
      },
      {
        name: '天坛',
        nameEn: 'Temple of Heaven',
        lat: 39.8826,
        lng: 116.4067,
        type: 'temple',
        description: '明清两代皇帝祭天祈谷的场所，世界文化遗产。',
      },
    ],
  },

  TJ: {
    code: 'TJ',
    name: '天津市',
    nameEn: 'Tianjin',
    center: [39.1422, 117.2018],
    landmarks: [
      {
        name: '天津之眼',
        nameEn: 'Tianjin Eye',
        lat: 39.1467,
        lng: 117.1728,
        type: 'building',
        description: '跨河建设的摩天轮，天津的地标性建筑。',
      },
      {
        name: '意式风情街',
        nameEn: 'Italian Style Town',
        lat: 39.1389,
        lng: 117.1778,
        type: 'ancient-town',
        description: '保存完整的意大利风貌建筑群。',
      },
    ],
  },

  HE: {
    code: 'HE',
    name: '河北省',
    nameEn: 'Hebei',
    center: [38.0456, 114.5149],
    landmarks: [
      {
        name: '避暑山庄',
        nameEn: 'Chengde Mountain Resort',
        lat: 40.9839,
        lng: 117.9625,
        type: 'palace',
        description: '清代皇家园林，中国现存最大的古代帝王宫苑。',
      },
      {
        name: '白洋淀',
        nameEn: 'Baiyangdian Lake',
        lat: 38.9375,
        lng: 115.9758,
        type: 'lake',
        description: '华北明珠，中国北方最大的淡水湿地。',
      },
    ],
  },

  SX: {
    code: 'SX',
    name: '山西省',
    nameEn: 'Shanxi',
    center: [37.857, 112.5629],
    landmarks: [
      {
        name: '平遥古城',
        nameEn: 'Pingyao Ancient City',
        lat: 37.195,
        lng: 112.1761,
        type: 'ancient-town',
        description: '保存最完整的古代县城之一，世界文化遗产。',
      },
      {
        name: '五台山',
        nameEn: 'Mount Wutai',
        lat: 39.0608,
        lng: 113.5786,
        type: 'mountain',
        description: '四大佛教名山之首，世界文化景观遗产。',
      },
    ],
  },

  NM: {
    code: 'NM',
    name: '内蒙古自治区',
    nameEn: 'Inner Mongolia',
    center: [40.818, 111.6708],
    landmarks: [
      {
        name: '呼伦贝尔草原',
        nameEn: 'Hulunbuir Grassland',
        lat: 49.2167,
        lng: 119.7667,
        type: 'grassland',
        description: '世界著名的天然牧场，中国最美的草原之一。',
      },
      {
        name: '响沙湾',
        nameEn: 'Xiangshawan Desert',
        lat: 40.0833,
        lng: 109.8167,
        type: 'desert',
        description: '库布其沙漠中的旅游胜地，以会响的沙子闻名。',
      },
    ],
  },

  // 东北地区
  LN: {
    code: 'LN',
    name: '辽宁省',
    nameEn: 'Liaoning',
    center: [41.8057, 123.4315],
    landmarks: [
      {
        name: '沈阳故宫',
        nameEn: 'Shenyang Imperial Palace',
        lat: 41.7967,
        lng: 123.4506,
        type: 'palace',
        description: '清朝入关前的皇宫，世界文化遗产。',
      },
      {
        name: '大连老虎滩',
        nameEn: 'Dalian Laohutan',
        lat: 38.8833,
        lng: 121.6167,
        type: 'beach',
        description: '著名的海滨风景区，大连的名片。',
      },
    ],
  },

  JL: {
    code: 'JL',
    name: '吉林省',
    nameEn: 'Jilin',
    center: [43.8868, 125.3245],
    landmarks: [
      {
        name: '长白山天池',
        nameEn: 'Changbai Mountain Tianchi',
        lat: 42.0067,
        lng: 128.0575,
        type: 'mountain',
        description: '中国最深的湖泊，朝鲜族圣山。',
      },
      {
        name: '雾凇岛',
        nameEn: 'Rime Island',
        lat: 43.7167,
        lng: 126.55,
        type: 'lake',
        description: '中国四大自然奇观之一，冬季雾凇景观。',
      },
    ],
  },

  HL: {
    code: 'HL',
    name: '黑龙江省',
    nameEn: 'Heilongjiang',
    center: [45.743, 126.6616],
    landmarks: [
      {
        name: '哈尔滨冰雪大世界',
        nameEn: 'Harbin Ice and Snow World',
        lat: 45.75,
        lng: 126.6333,
        type: 'building',
        description: '世界规模最大的冰雪主题公园。',
      },
      {
        name: '五大连池',
        nameEn: 'Wudalianchi',
        lat: 48.7167,
        lng: 126.1167,
        type: 'lake',
        description: '火山堰塞湖群，世界地质公园。',
      },
    ],
  },

  // 华东地区
  SH: {
    code: 'SH',
    name: '上海市',
    nameEn: 'Shanghai',
    center: [31.2304, 121.4737],
    landmarks: [
      {
        name: '外滩',
        nameEn: 'The Bund',
        lat: 31.2397,
        lng: 121.49,
        type: 'ancient-town',
        description: '上海的象征，万国建筑博览群。',
      },
      {
        name: '东方明珠',
        nameEn: 'Oriental Pearl Tower',
        lat: 31.2397,
        lng: 121.4994,
        type: 'tower',
        description: '上海地标性建筑，亚洲第一高塔。',
      },
      {
        name: '豫园',
        nameEn: 'Yu Garden',
        lat: 31.2275,
        lng: 121.4922,
        type: 'garden',
        description: '明代私家园林，江南园林艺术的代表。',
      },
    ],
  },

  JS: {
    code: 'JS',
    name: '江苏省',
    nameEn: 'Jiangsu',
    center: [32.0603, 118.7969],
    landmarks: [
      {
        name: '苏州园林',
        nameEn: 'Suzhou Gardens',
        lat: 31.2989,
        lng: 120.5853,
        type: 'garden',
        description: '中国古典园林的代表，世界文化遗产。',
      },
      {
        name: '南京夫子庙',
        nameEn: 'Nanjing Confucius Temple',
        lat: 32.0167,
        lng: 118.7833,
        type: 'temple',
        description: '秦淮河畔的文化地标，六朝古都风貌。',
      },
      {
        name: '扬州瘦西湖',
        nameEn: 'Yangzhou Slender West Lake',
        lat: 32.4167,
        lng: 119.4333,
        type: 'lake',
        description: '著名的湖上园林，扬州园林的代表。',
      },
    ],
  },

  ZJ: {
    code: 'ZJ',
    name: '浙江省',
    nameEn: 'Zhejiang',
    center: [30.287, 120.153],
    landmarks: [
      {
        name: '西湖',
        nameEn: 'West Lake',
        lat: 30.2489,
        lng: 120.1481,
        type: 'lake',
        description: '世界文化遗产，中国最著名的湖泊之一。',
      },
      {
        name: '普陀山',
        nameEn: 'Mount Putuo',
        lat: 29.9833,
        lng: 122.3833,
        type: 'mountain',
        description: '四大佛教名山之一，观音道场。',
      },
      {
        name: '乌镇',
        nameEn: 'Wuzhen',
        lat: 30.7417,
        lng: 120.4917,
        type: 'ancient-town',
        description: '典型的江南水乡古镇。',
      },
    ],
  },

  AH: {
    code: 'AH',
    name: '安徽省',
    nameEn: 'Anhui',
    center: [31.8612, 117.2838],
    landmarks: [
      {
        name: '黄山',
        nameEn: 'Mount Huangshan',
        lat: 30.1333,
        lng: 118.1667,
        type: 'mountain',
        description: '世界自然与文化双遗产，中国最美的山。',
      },
      {
        name: '宏村',
        nameEn: 'Hongcun Village',
        lat: 29.9083,
        lng: 117.9917,
        type: 'village',
        description: '徽派建筑的代表，画中的村庄。',
      },
    ],
  },

  FJ: {
    code: 'FJ',
    name: '福建省',
    nameEn: 'Fujian',
    center: [26.0745, 119.2965],
    landmarks: [
      {
        name: '鼓浪屿',
        nameEn: 'Gulangyu Island',
        lat: 24.4467,
        lng: 118.0656,
        type: 'ancient-town',
        description: '世界文化遗产，万国建筑博物馆。',
      },
      {
        name: '武夷山',
        nameEn: 'Mount Wuyi',
        lat: 27.7667,
        lng: 118.0333,
        type: 'mountain',
        description: '世界自然与文化双遗产，丹霞地貌。',
      },
      {
        name: '土楼',
        nameEn: 'Fujian Tulou',
        lat: 24.6333,
        lng: 117.0,
        type: 'fortress',
        description: '世界文化遗产，客家土楼建筑群。',
      },
    ],
  },

  JX: {
    code: 'JX',
    name: '江西省',
    nameEn: 'Jiangxi',
    center: [28.6829, 115.8579],
    landmarks: [
      {
        name: '庐山',
        nameEn: 'Mount Lushan',
        lat: 29.5833,
        lng: 115.9833,
        type: 'mountain',
        description: '世界文化景观遗产，中国名山之一。',
      },
      {
        name: '婺源',
        nameEn: 'Wuyuan',
        lat: 29.25,
        lng: 117.8667,
        type: 'village',
        description: '中国最美的乡村，油菜花海闻名。',
      },
      {
        name: '景德镇',
        nameEn: 'Jingdezhen',
        lat: 29.2681,
        lng: 117.1786,
        type: 'ancient-town',
        description: '千年瓷都，中国陶瓷文化的代表。',
      },
    ],
  },

  SD: {
    code: 'SD',
    name: '山东省',
    nameEn: 'Shandong',
    center: [36.6683, 117.0208],
    landmarks: [
      {
        name: '泰山',
        nameEn: 'Mount Tai',
        lat: 36.25,
        lng: 117.1,
        type: 'mountain',
        description: '五岳之首，世界自然与文化双遗产。',
      },
      {
        name: '曲阜三孔',
        nameEn: 'Qufu Three Confucius Sites',
        lat: 35.5967,
        lng: 116.9814,
        type: 'temple',
        description: '孔庙、孔府、孔林，世界文化遗产。',
      },
      {
        name: '青岛栈桥',
        nameEn: 'Qingdao Pier',
        lat: 36.0581,
        lng: 120.32,
        type: 'bridge',
        description: '青岛的象征，德式建筑风格海滨景观。',
      },
    ],
  },

  // 华中地区
  HA: {
    code: 'HA',
    name: '河南省',
    nameEn: 'Henan',
    center: [34.7658, 113.7537],
    landmarks: [
      {
        name: '龙门石窟',
        nameEn: 'Longmen Grottoes',
        lat: 34.555,
        lng: 112.475,
        type: 'cave',
        description: '世界文化遗产，中国石刻艺术宝库。',
      },
      {
        name: '少林寺',
        nameEn: 'Shaolin Temple',
        lat: 34.5089,
        lng: 112.9383,
        type: 'temple',
        description: '禅宗祖庭，中国武术圣地。',
      },
      {
        name: '云台山',
        nameEn: 'Yuntai Mountain',
        lat: 35.4167,
        lng: 113.3667,
        type: 'mountain',
        description: '世界地质公园，红石峡奇景。',
      },
    ],
  },

  HB: {
    code: 'HB',
    name: '湖北省',
    nameEn: 'Hubei',
    center: [30.5931, 114.3055],
    landmarks: [
      {
        name: '武汉黄鹤楼',
        nameEn: 'Yellow Crane Tower',
        lat: 30.5456,
        lng: 114.2969,
        type: 'tower',
        description: '江南三大名楼之一，武汉的地标。',
      },
      {
        name: '神农架',
        nameEn: 'Shennongjia',
        lat: 31.7444,
        lng: 110.6714,
        type: 'mountain',
        description: '世界自然遗产，原始森林和野人传说。',
      },
      {
        name: '三峡',
        nameEn: 'Three Gorges',
        lat: 30.8167,
        lng: 110.9833,
        type: 'river',
        description: '长江最美的峡谷风光。',
      },
    ],
  },

  HN: {
    code: 'HN',
    name: '湖南省',
    nameEn: 'Hunan',
    center: [28.1127, 112.9836],
    landmarks: [
      {
        name: '张家界',
        nameEn: 'Zhangjiajie',
        lat: 29.1167,
        lng: 110.4783,
        type: 'mountain',
        description: '世界自然遗产，阿凡达取景地。',
      },
      {
        name: '凤凰古城',
        nameEn: 'Fenghuang Ancient Town',
        lat: 27.9483,
        lng: 109.5989,
        type: 'ancient-town',
        description: '中国最美的古城之一，沈从文故乡。',
      },
      {
        name: '岳阳楼',
        nameEn: 'Yueyang Tower',
        lat: 29.3708,
        lng: 113.0989,
        type: 'tower',
        description: '江南三大名楼之一，洞庭湖畔。',
      },
    ],
  },

  // 华南地区
  GD: {
    code: 'GD',
    name: '广东省',
    nameEn: 'Guangdong',
    center: [23.1322, 113.2644],
    landmarks: [
      {
        name: '广州塔',
        nameEn: 'Canton Tower',
        lat: 23.1061,
        lng: 113.3189,
        type: 'tower',
        description: '广州新地标，中国第一高塔。',
      },
      {
        name: '丹霞山',
        nameEn: 'Danxia Mountain',
        lat: 25.0333,
        lng: 113.7333,
        type: 'mountain',
        description: '世界自然遗产，丹霞地貌命名地。',
      },
      {
        name: '开平碉楼',
        nameEn: 'Kaiping Diaolou',
        lat: 22.3667,
        lng: 112.6833,
        type: 'fortress',
        description: '世界文化遗产，中西合璧的乡土建筑。',
      },
    ],
  },

  GX: {
    code: 'GX',
    name: '广西壮族自治区',
    nameEn: 'Guangxi',
    center: [22.8154, 108.3275],
    landmarks: [
      {
        name: '桂林山水',
        nameEn: 'Guilin Landscape',
        lat: 25.2736,
        lng: 110.29,
        type: 'mountain',
        description: '甲天下的山水风光，喀斯特地貌典范。',
      },
      {
        name: '龙脊梯田',
        nameEn: 'Longji Rice Terraces',
        lat: 25.8,
        lng: 110.1167,
        type: 'mountain',
        description: '壮族梯田景观，大地艺术杰作。',
      },
      {
        name: '德天瀑布',
        nameEn: 'Detian Waterfall',
        lat: 22.8333,
        lng: 106.7167,
        type: 'waterfall',
        description: '亚洲第一跨国瀑布，中越边境奇观。',
      },
    ],
  },

  HI: {
    code: 'HI',
    name: '海南省',
    nameEn: 'Hainan',
    center: [20.0178, 110.349],
    landmarks: [
      {
        name: '亚龙湾',
        nameEn: 'Yalong Bay',
        lat: 18.2258,
        lng: 109.6403,
        type: 'beach',
        description: '天下第一湾，热带海滨度假胜地。',
      },
      {
        name: '天涯海角',
        nameEn: 'Tianya Haijiao',
        lat: 18.2989,
        lng: 109.3589,
        type: 'beach',
        description: '中国最南端的浪漫地标。',
      },
    ],
  },

  // 西南地区
  CQ: {
    code: 'CQ',
    name: '重庆市',
    nameEn: 'Chongqing',
    center: [29.563, 106.5516],
    landmarks: [
      {
        name: '洪崖洞',
        nameEn: 'Hongya Cave',
        lat: 29.5628,
        lng: 106.5811,
        type: 'ancient-town',
        description: '巴渝传统建筑，山城夜景代表。',
      },
      {
        name: '大足石刻',
        nameEn: 'Dazu Rock Carvings',
        lat: 29.7167,
        lng: 105.7167,
        type: 'cave',
        description: '世界文化遗产，石窟艺术瑰宝。',
      },
      {
        name: '武隆天坑',
        nameEn: 'Wulong Karst',
        lat: 29.325,
        lng: 107.7611,
        type: 'cave',
        description: '世界自然遗产，喀斯特地貌奇观。',
      },
    ],
  },

  SC: {
    code: 'SC',
    name: '四川省',
    nameEn: 'Sichuan',
    center: [30.5728, 104.0668],
    landmarks: [
      {
        name: '九寨沟',
        nameEn: 'Jiuzhaigou',
        lat: 33.26,
        lng: 103.92,
        type: 'lake',
        description: '世界自然遗产，人间仙境。',
      },
      {
        name: '峨眉山',
        nameEn: 'Mount Emei',
        lat: 29.5447,
        lng: 103.3347,
        type: 'mountain',
        description: '四大佛教名山之一，普贤菩萨道场。',
      },
      {
        name: '都江堰',
        nameEn: 'Dujiangyan',
        lat: 31.005,
        lng: 103.6178,
        type: 'river',
        description: '世界文化遗产，古代水利工程奇迹。',
      },
    ],
  },

  GZ: {
    code: 'GZ',
    name: '贵州省',
    nameEn: 'Guizhou',
    center: [26.5783, 106.7072],
    landmarks: [
      {
        name: '黄果树瀑布',
        nameEn: 'Huangguoshu Waterfall',
        lat: 25.7083,
        lng: 105.675,
        type: 'waterfall',
        description: '亚洲第一大瀑布，贵州名片。',
      },
      {
        name: '荔波小七孔',
        nameEn: 'Libo Xiaoqikong',
        lat: 25.2917,
        lng: 107.9831,
        type: 'lake',
        description: '世界自然遗产，喀斯特森林奇观。',
      },
      {
        name: '西江千户苗寨',
        nameEn: 'Xijiang Miao Village',
        lat: 26.5817,
        lng: 108.1761,
        type: 'village',
        description: '世界最大的苗寨，民族文化体验地。',
      },
    ],
  },

  YN: {
    code: 'YN',
    name: '云南省',
    nameEn: 'Yunnan',
    center: [25.0406, 102.7129],
    landmarks: [
      {
        name: '丽江古城',
        nameEn: 'Lijiang Old Town',
        lat: 26.8769,
        lng: 100.2289,
        type: 'ancient-town',
        description: '世界文化遗产，纳西族古城。',
      },
      {
        name: '石林',
        nameEn: 'Stone Forest',
        lat: 24.8167,
        lng: 103.3167,
        type: 'mountain',
        description: '世界自然遗产，喀斯特地貌博物馆。',
      },
      {
        name: '玉龙雪山',
        nameEn: 'Jade Dragon Snow Mountain',
        lat: 27.1167,
        lng: 100.25,
        type: 'glacier',
        description: '北半球最南的雪山，纳西族神山。',
      },
    ],
  },

  XZ: {
    code: 'XZ',
    name: '西藏自治区',
    nameEn: 'Tibet',
    center: [29.644, 91.1172],
    landmarks: [
      {
        name: '布达拉宫',
        nameEn: 'Potala Palace',
        lat: 29.6558,
        lng: 91.1172,
        type: 'palace',
        description: '世界文化遗产，藏传佛教圣地。',
      },
      {
        name: '纳木错',
        nameEn: 'Namtso Lake',
        lat: 30.7,
        lng: 90.6,
        type: 'lake',
        description: '西藏三大圣湖之一，天湖美景。',
      },
      {
        name: '珠穆朗玛峰',
        nameEn: 'Mount Everest',
        lat: 27.9881,
        lng: 86.925,
        type: 'glacier',
        description: '世界第一高峰，登山者的终极梦想。',
      },
    ],
  },

  // 西北地区
  SN: {
    code: 'SN',
    name: '陕西省',
    nameEn: 'Shaanxi',
    center: [34.2658, 108.9541],
    landmarks: [
      {
        name: '兵马俑',
        nameEn: 'Terracotta Warriors',
        lat: 34.3856,
        lng: 109.2783,
        type: 'museum',
        description: '世界文化遗产，世界第八大奇迹。',
      },
      {
        name: '华山',
        nameEn: 'Mount Hua',
        lat: 34.4889,
        lng: 110.085,
        type: 'mountain',
        description: '五岳之一，西岳奇险天下第一山。',
      },
      {
        name: '大雁塔',
        nameEn: 'Giant Wild Goose Pagoda',
        lat: 34.2217,
        lng: 108.9644,
        type: 'tower',
        description: '唐代佛教建筑，西安地标。',
      },
    ],
  },

  GS: {
    code: 'GS',
    name: '甘肃省',
    nameEn: 'Gansu',
    center: [36.0611, 103.8343],
    landmarks: [
      {
        name: '莫高窟',
        nameEn: 'Mogao Caves',
        lat: 40.0408,
        lng: 94.8031,
        type: 'cave',
        description: '世界文化遗产，佛教艺术宝库。',
      },
      {
        name: '鸣沙山月牙泉',
        nameEn: 'Mingsha Mountain and Crescent Lake',
        lat: 40.0889,
        lng: 94.6689,
        type: 'desert',
        description: '沙漠奇观，沙泉共生的自然景观。',
      },
      {
        name: '嘉峪关',
        nameEn: 'Jiayuguan Pass',
        lat: 39.8167,
        lng: 98.2833,
        type: 'fortress',
        description: '天下第一雄关，长城西端起点。',
      },
    ],
  },

  QH: {
    code: 'QH',
    name: '青海省',
    nameEn: 'Qinghai',
    center: [36.6171, 101.7782],
    landmarks: [
      {
        name: '青海湖',
        nameEn: 'Qinghai Lake',
        lat: 36.8833,
        lng: 100.1833,
        type: 'lake',
        description: '中国最大的咸水湖，高原明珠。',
      },
      {
        name: '茶卡盐湖',
        nameEn: 'Chaka Salt Lake',
        lat: 36.7333,
        lng: 99.1,
        type: 'lake',
        description: '天空之镜，中国的玻利维亚。',
      },
    ],
  },

  NX: {
    code: 'NX',
    name: '宁夏回族自治区',
    nameEn: 'Ningxia',
    center: [38.4681, 106.2586],
    landmarks: [
      {
        name: '沙坡头',
        nameEn: 'Shapotou',
        lat: 37.5,
        lng: 105.1833,
        type: 'desert',
        description: '沙漠与黄河交汇的奇观。',
      },
      {
        name: '西夏王陵',
        nameEn: 'Western Xia Tombs',
        lat: 38.4333,
        lng: 105.9667,
        type: 'memorial',
        description: '神秘的西夏文化遗址。',
      },
    ],
  },

  XJ: {
    code: 'XJ',
    name: '新疆维吾尔自治区',
    nameEn: 'Xinjiang',
    center: [43.8256, 87.6168],
    landmarks: [
      {
        name: '天山天池',
        nameEn: 'Tianchi Lake',
        lat: 43.8833,
        lng: 88.1333,
        type: 'lake',
        description: '雪山冰川湖泊，瑶池仙境。',
      },
      {
        name: '喀纳斯',
        nameEn: 'Kanas Lake',
        lat: 48.7,
        lng: 87.0,
        type: 'lake',
        description: '神的自留地，中国最美湖泊。',
      },
      {
        name: '吐鲁番火焰山',
        nameEn: 'Flaming Mountains',
        lat: 42.95,
        lng: 89.5833,
        type: 'desert',
        description: '西游记取景地，地表最热的地方。',
      },
    ],
  },

  // 港澳台
  HK: {
    code: 'HK',
    name: '香港特别行政区',
    nameEn: 'Hong Kong',
    center: [22.3193, 114.1694],
    landmarks: [
      {
        name: '维多利亚港',
        nameEn: 'Victoria Harbour',
        lat: 22.2908,
        lng: 114.1722,
        type: 'beach',
        description: '世界三大天然良港，香港夜景名片。',
      },
      {
        name: '太平山顶',
        nameEn: 'Victoria Peak',
        lat: 22.2714,
        lng: 114.1489,
        type: 'mountain',
        description: '俯瞰香港全景的最佳位置。',
      },
    ],
  },

  MO: {
    code: 'MO',
    name: '澳门特别行政区',
    nameEn: 'Macau',
    center: [22.1987, 113.5439],
    landmarks: [
      {
        name: '大三巴牌坊',
        nameEn: 'Ruins of St. Paul',
        lat: 22.1975,
        lng: 113.5419,
        type: 'memorial',
        description: '世界文化遗产，澳门标志性建筑。',
      },
      {
        name: '澳门塔',
        nameEn: 'Macau Tower',
        lat: 22.1803,
        lng: 113.5397,
        type: 'tower',
        description: '世界第十高塔，蹦极圣地。',
      },
    ],
  },

  TW: {
    code: 'TW',
    name: '台湾省',
    nameEn: 'Taiwan',
    center: [23.6978, 120.9605],
    landmarks: [
      {
        name: '台北101',
        nameEn: 'Taipei 101',
        lat: 25.0339,
        lng: 121.5645,
        type: 'building',
        description: '曾经的世界第一高楼，台北地标。',
      },
      {
        name: '日月潭',
        nameEn: 'Sun Moon Lake',
        lat: 23.8569,
        lng: 120.9153,
        type: 'lake',
        description: '台湾最大的天然湖泊，山水秀美。',
      },
      {
        name: '阿里山',
        nameEn: 'Alishan',
        lat: 23.5083,
        lng: 120.8028,
        type: 'mountain',
        description: '日出、云海、铁路、森林、晚霞五奇。',
      },
    ],
  },
};

/**
 * Get all landmarks as a flat array
 */
export function getAllLandmarks(): Array<ProvinceLandmark & { provinceCode: string; provinceName: string }> {
  const landmarks: Array<ProvinceLandmark & { provinceCode: string; provinceName: string }> = [];

  for (const [code, province] of Object.entries(CHINA_PROVINCES)) {
    for (const landmark of province.landmarks) {
      landmarks.push({
        ...landmark,
        provinceCode: code,
        provinceName: province.name,
      });
    }
  }

  return landmarks;
}

/**
 * Get province name in Chinese
 */
export function getProvinceName(code: string): string {
  return CHINA_PROVINCES[code]?.name || code;
}

/**
 * Known typos/variants in the bundled admin-1 dataset → the CHINA_PROVINCES
 * nameEn they actually mean. admin1.geojson.gz labels Guangdong as
 * "Guangzhou Province"; map it back instead of special-casing the caller.
 */
const ENGLISH_PROVINCE_ALIASES: Record<string, string> = {
  guangzhou: 'guangdong',
};

/**
 * Normalize an English province name for matching.
 *
 * The bundled admin-1 data carries full formal English names ("Beijing
 * Municipality", "Guangxi Zhuang Autonomous Region", "Ningxia Ningxia Hui
 * Autonomous Region" — sic), while CHINA_PROVINCES keys on short names
 * ("Beijing", "Guangxi", "Ningxia"). Fold the difference on both sides:
 * strip administrative suffixes, drop ethnic qualifiers, collapse accidental
 * word duplication, then apply the alias table.
 */
function normalizeEnglishProvinceName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/\s+(special\s+administrative\s+region|autonomous\s+region|municipality|province)\s*$/i, '')
    .replace(/\b(zhuang|hui|uyghur)\b/g, '')
    .split(/\s+/)
    .filter((word, index, words) => index === 0 || word !== words[index - 1])
    .join(' ')
    .trim();
  return ENGLISH_PROVINCE_ALIASES[cleaned] ?? cleaned;
}

/**
 * Get Chinese province name by English name
 * 根据英文名称获取中文省份名称
 */
export function getProvinceNameByEnglish(nameEn: string): string | null {
  if (!nameEn) return null;
  const normalized = normalizeEnglishProvinceName(nameEn);
  if (!normalized) return null;
  for (const province of Object.values(CHINA_PROVINCES)) {
    if (normalizeEnglishProvinceName(province.nameEn) === normalized) {
      return province.name;
    }
  }
  return null;
}

/**
 * Check if a code is a Chinese province
 */
export function isChineseProvince(code: string): boolean {
  return code in CHINA_PROVINCES;
}
