import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';

export interface PhoneInsights {
  phone: string;
  hasRealPhone: boolean;
  country: string;
  countryEn: string;
  regionSource: 'phone' | 'flag' | 'name' | 'none';
  regionSourceLabel: string;
  timezone: string;
  localTime: string;
  workingHint: string;
  available: boolean;
  fallbackText?: string;
}

interface RegionInfo {
  country: string;
  countryEn?: string;
  timezone: string;
}

/**
 * Country code +1 is shared by the NANP. A bare +1 is not enough to choose a
 * country or timezone, so match the geographic area code first. Canadian area
 * codes are grouped by the timezone that covers the main numbering area.
 */
const NANP_PREFIXES: Array<RegionInfo & { prefix: string }> = [
  // Caribbean countries and territories
  { prefix: '1242', country: '巴哈马', countryEn: 'Bahamas', timezone: 'America/Nassau' },
  { prefix: '1246', country: '巴巴多斯', countryEn: 'Barbados', timezone: 'America/Barbados' },
  { prefix: '1264', country: '安圭拉', countryEn: 'Anguilla', timezone: 'America/Anguilla' },
  { prefix: '1268', country: '安提瓜和巴布达', countryEn: 'Antigua and Barbuda', timezone: 'America/Antigua' },
  { prefix: '1284', country: '英属维尔京群岛', countryEn: 'British Virgin Islands', timezone: 'America/Tortola' },
  { prefix: '1340', country: '美属维尔京群岛', countryEn: 'U.S. Virgin Islands', timezone: 'America/St_Thomas' },
  { prefix: '1345', country: '开曼群岛', countryEn: 'Cayman Islands', timezone: 'America/Cayman' },
  { prefix: '1441', country: '百慕大', countryEn: 'Bermuda', timezone: 'Atlantic/Bermuda' },
  { prefix: '1473', country: '格林纳达', countryEn: 'Grenada', timezone: 'America/Grenada' },
  { prefix: '1649', country: '特克斯和凯科斯群岛', countryEn: 'Turks and Caicos Islands', timezone: 'America/Grand_Turk' },
  { prefix: '1658', country: '牙买加', countryEn: 'Jamaica', timezone: 'America/Jamaica' },
  { prefix: '1664', country: '蒙特塞拉特', countryEn: 'Montserrat', timezone: 'America/Montserrat' },
  { prefix: '1670', country: '北马里亚纳群岛', countryEn: 'Northern Mariana Islands', timezone: 'Pacific/Saipan' },
  { prefix: '1671', country: '关岛', countryEn: 'Guam', timezone: 'Pacific/Guam' },
  { prefix: '1684', country: '美属萨摩亚', countryEn: 'American Samoa', timezone: 'Pacific/Pago_Pago' },
  { prefix: '1721', country: '荷属圣马丁', countryEn: 'Sint Maarten', timezone: 'America/Lower_Princes' },
  { prefix: '1758', country: '圣卢西亚', countryEn: 'Saint Lucia', timezone: 'America/St_Lucia' },
  { prefix: '1767', country: '多米尼克', countryEn: 'Dominica', timezone: 'America/Dominica' },
  { prefix: '1784', country: '圣文森特和格林纳丁斯', countryEn: 'Saint Vincent and the Grenadines', timezone: 'America/St_Vincent' },
  { prefix: '1787', country: '波多黎各', countryEn: 'Puerto Rico', timezone: 'America/Puerto_Rico' },
  { prefix: '1809', country: '多米尼加共和国', countryEn: 'Dominican Republic', timezone: 'America/Santo_Domingo' },
  { prefix: '1829', country: '多米尼加共和国', countryEn: 'Dominican Republic', timezone: 'America/Santo_Domingo' },
  { prefix: '1849', country: '多米尼加共和国', countryEn: 'Dominican Republic', timezone: 'America/Santo_Domingo' },
  { prefix: '1868', country: '特立尼达和多巴哥', countryEn: 'Trinidad and Tobago', timezone: 'America/Port_of_Spain' },
  { prefix: '1869', country: '圣基茨和尼维斯', countryEn: 'Saint Kitts and Nevis', timezone: 'America/St_Kitts' },
  { prefix: '1876', country: '牙买加', countryEn: 'Jamaica', timezone: 'America/Jamaica' },
  { prefix: '1939', country: '波多黎各', countryEn: 'Puerto Rico', timezone: 'America/Puerto_Rico' },

  // Canada: Newfoundland, Atlantic, Eastern, Central, Mountain and Pacific
  ...['1709', '1879'].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/St_Johns' })),
  ...['1428', '1506', '1782', '1902'].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/Halifax' })),
  ...[
    '1226', '1249', '1263', '1289', '1343', '1354', '1365', '1367', '1382',
    '1416', '1418', '1437', '1438', '1450', '1468', '1514', '1519', '1548',
    '1579', '1581', '1613', '1647', '1683', '1705', '1742', '1753', '1819',
    '1873', '1905', '1942',
  ].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/Toronto' })),
  ...['1204', '1431', '1584', '1807'].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/Winnipeg' })),
  ...['1306', '1474', '1639'].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/Regina' })),
  ...['1368', '1403', '1587', '1780', '1825'].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/Edmonton' })),
  ...['1236', '1250', '1257', '1604', '1672', '1778'].map((prefix) => ({ prefix, country: '加拿大', countryEn: 'Canada', timezone: 'America/Vancouver' })),

  // United States: Eastern, Central, Mountain, Pacific, Alaska, Hawaii
  // Eastern Time (ET)
  ...[
    '1201', '1202', '1203', '1207', '1212', '1215', '1216', '1217', '1220', '1223', '1224',
    '1227', '1228', '1229', '1234', '1239', '1240', '1248', '1252', '1267', '1269', '1272',
    '1274', '1276', '1281', '1301', '1302', '1305', '1307', '1313', '1315', '1321', '1330',
    '1332', '1336', '1339', '1347', '1351', '1352', '1360', '1386', '1401', '1404', '1407',
    '1410', '1412', '1419', '1423', '1430', '1440', '1443', '1447', '1458', '1463', '1470',
    '1475', '1478', '1484', '1508', '1513', '1516', '1517', '1551', '1561', '1563', '1567',
    '1570', '1571', '1585', '1586', '1601', '1603', '1606', '1607', '1614', '1617', '1630',
    '1641', '1646', '1667', '1678', '1680', '1689', '1704', '1706', '1716', '1717', '1718',
    '1724', '1727', '1732', '1740', '1743', '1754', '1757', '1762', '1765', '1770', '1772',
    '1773', '1774', '1781', '1786', '1803', '1810', '1812', '1813', '1814', '1828', '1838',
    '1843', '1845', '1847', '1848', '1850', '1854', '1856', '1859', '1860', '1862', '1863',
    '1864', '1865', '1870', '1872', '1878', '1901', '1904', '1908', '1910', '1912', '1914',
    '1917', '1919', '1929', '1930', '1931', '1934', '1937', '1941', '1947', '1949', '1954',
    '1959', '1970', '1973', '1978', '1980', '1984', '1989',
  ].map((prefix) => ({ prefix, country: '美国', countryEn: 'United States', timezone: 'America/New_York' })),

  // Central Time (CT)
  ...[
    '1205', '1214', '1218', '1219', '1225', '1251', '1254', '1256', '1260', '1262', '1270',
    '1280', '1309', '1312', '1316', '1318', '1319', '1320', '1331', '1334', '1337', '1346',
    '1361', '1364', '1380', '1402', '1405', '1409', '1414', '1417', '1423', '1432', '1434',
    '1440', '1469', '1479', '1501', '1507', '1512', '1515', '1563', '1573', '1574', '1580',
    '1601', '1605', '1608', '1620', '1630', '1636', '1641', '1651', '1660', '1662', '1682',
    '1708', '1712', '1713', '1715', '1731', '1737', '1763', '1769', '1773', '1785', '1801',
    '1806', '1815', '1817', '1830', '1832', '1847', '1870', '1903', '1913', '1918', '1920',
    '1936', '1940', '1945', '1952', '1956', '1972', '1979', '1985',
  ].map((prefix) => ({ prefix, country: '美国', countryEn: 'United States', timezone: 'America/Chicago' })),

  // Mountain Time (MT)
  ...[
    '1208', '1303', '1307', '1385', '1406', '1435', '1480', '1505', '1520', '1575', '1602',
    '1623', '1702', '1719', '1720', '1775', '1801', '1928', '1970',
  ].map((prefix) => ({ prefix, country: '美国', countryEn: 'United States', timezone: 'America/Denver' })),

  // Pacific Time (PT)
  ...[
    '1206', '1209', '1213', '1253', '1279', '1310', '1323', '1341', '1350', '1408', '1415',
    '1424', '1442', '1510', '1530', '1541', '1559', '1562', '1619', '1626', '1628', '1650',
    '1657', '1661', '1669', '1707', '1714', '1747', '1760', '1805', '1818', '1820', '1831',
    '1858', '1909', '1916', '1925', '1949', '1951', '1971',
  ].map((prefix) => ({ prefix, country: '美国', countryEn: 'United States', timezone: 'America/Los_Angeles' })),

  // Alaska Time (AKST)
  ...['1907'].map((prefix) => ({ prefix, country: '美国', countryEn: 'United States', timezone: 'America/Anchorage' })),

  // Hawaii-Aleutian Time (HST)
  ...['1808'].map((prefix) => ({ prefix, country: '美国', countryEn: 'United States', timezone: 'Pacific/Honolulu' })),
];

const COUNTRY_PREFIXES: Array<RegionInfo & { prefix: string }> = [
  ...NANP_PREFIXES,
  { prefix: '3906698', country: '梵蒂冈', countryEn: 'Vatican City', timezone: 'Europe/Vatican' },
  { prefix: '262269', country: '马约特', countryEn: 'Mayotte', timezone: 'Indian/Mayotte' },
  { prefix: '262639', country: '马约特', countryEn: 'Mayotte', timezone: 'Indian/Mayotte' },
  { prefix: '76', country: '哈萨克斯坦', countryEn: 'Kazakhstan', timezone: 'Asia/Almaty' },
  { prefix: '77', country: '哈萨克斯坦', countryEn: 'Kazakhstan', timezone: 'Asia/Almaty' },
  { prefix: '211', country: '南苏丹', countryEn: 'South Sudan', timezone: 'Africa/Juba' },
  { prefix: '246', country: '英属印度洋领地', countryEn: 'British Indian Ocean Territory', timezone: 'Indian/Chagos' },
  { prefix: '247', country: '阿森松岛', countryEn: 'Ascension Island', timezone: 'Atlantic/St_Helena' },
  { prefix: '252', country: '索马里', countryEn: 'Somalia', timezone: 'Africa/Mogadishu' },
  { prefix: '253', country: '吉布提', countryEn: 'Djibouti', timezone: 'Africa/Djibouti' },
  { prefix: '262', country: '留尼汪', countryEn: 'Réunion', timezone: 'Indian/Reunion' },
  { prefix: '290', country: '圣赫勒拿', countryEn: 'Saint Helena', timezone: 'Atlantic/St_Helena' },
  { prefix: '297', country: '阿鲁巴', countryEn: 'Aruba', timezone: 'America/Aruba' },
  { prefix: '298', country: '法罗群岛', countryEn: 'Faroe Islands', timezone: 'Atlantic/Faroe' },
  { prefix: '299', country: '格陵兰', countryEn: 'Greenland', timezone: 'America/Nuuk' },
  { prefix: '500', country: '福克兰群岛', countryEn: 'Falkland Islands', timezone: 'Atlantic/Stanley' },
  { prefix: '508', country: '圣皮埃尔和密克隆', countryEn: 'Saint Pierre and Miquelon', timezone: 'America/Miquelon' },
  { prefix: '590', country: '瓜德罗普', countryEn: 'Guadeloupe', timezone: 'America/Guadeloupe' },
  { prefix: '594', country: '法属圭亚那', countryEn: 'French Guiana', timezone: 'America/Cayenne' },
  { prefix: '596', country: '马提尼克', countryEn: 'Martinique', timezone: 'America/Martinique' },
  { prefix: '599', country: '荷属加勒比', countryEn: 'Caribbean Netherlands', timezone: 'America/Curacao' },
  { prefix: '672', country: '诺福克岛', countryEn: 'Norfolk Island', timezone: 'Pacific/Norfolk' },
  { prefix: '850', country: '朝鲜', countryEn: 'North Korea', timezone: 'Asia/Pyongyang' },
  { prefix: '670', country: '东帝汶', timezone: 'Asia/Dili' },
  { prefix: '673', country: '文莱', countryEn: 'Brunei', timezone: 'Asia/Brunei' },
  { prefix: '674', country: '瑙鲁', timezone: 'Pacific/Nauru' },
  { prefix: '675', country: '巴布亚新几内亚', timezone: 'Pacific/Port_Moresby' },
  { prefix: '676', country: '汤加', timezone: 'Pacific/Tongatapu' },
  { prefix: '677', country: '所罗门群岛', timezone: 'Pacific/Guadalcanal' },
  { prefix: '678', country: '瓦努阿图', timezone: 'Pacific/Efate' },
  { prefix: '679', country: '斐济', timezone: 'Pacific/Fiji' },
  { prefix: '680', country: '帕劳', timezone: 'Pacific/Palau' },
  { prefix: '681', country: '瓦利斯和富图纳', timezone: 'Pacific/Wallis' },
  { prefix: '682', country: '库克群岛', timezone: 'Pacific/Rarotonga' },
  { prefix: '683', country: '纽埃', timezone: 'Pacific/Niue' },
  { prefix: '685', country: '萨摩亚', timezone: 'Pacific/Apia' },
  { prefix: '686', country: '基里巴斯', timezone: 'Pacific/Tarawa' },
  { prefix: '687', country: '新喀里多尼亚', timezone: 'Pacific/Noumea' },
  { prefix: '688', country: '图瓦卢', timezone: 'Pacific/Funafuti' },
  { prefix: '689', country: '法属波利尼西亚', timezone: 'Pacific/Tahiti' },
  { prefix: '690', country: '托克劳', timezone: 'Pacific/Fakaofo' },
  { prefix: '691', country: '密克罗尼西亚', timezone: 'Pacific/Pohnpei' },
  { prefix: '692', country: '马绍尔群岛', timezone: 'Pacific/Majuro' },
  { prefix: '880', country: '孟加拉', countryEn: 'Bangladesh', timezone: 'Asia/Dhaka' },
  { prefix: '886', country: '台湾', timezone: 'Asia/Taipei' },
  { prefix: '852', country: '香港', timezone: 'Asia/Hong_Kong' },
  { prefix: '853', country: '澳门', timezone: 'Asia/Macau' },
  { prefix: '855', country: '柬埔寨', timezone: 'Asia/Phnom_Penh' },
  { prefix: '856', country: '老挝', timezone: 'Asia/Vientiane' },
  { prefix: '961', country: '黎巴嫩', countryEn: 'Lebanon', timezone: 'Asia/Beirut' },
  { prefix: '962', country: '约旦', countryEn: 'Jordan', timezone: 'Asia/Amman' },
  { prefix: '963', country: '叙利亚', countryEn: 'Syria', timezone: 'Asia/Damascus' },
  { prefix: '964', country: '伊拉克', countryEn: 'Iraq', timezone: 'Asia/Baghdad' },
  { prefix: '965', country: '科威特', countryEn: 'Kuwait', timezone: 'Asia/Kuwait' },
  { prefix: '966', country: '沙特', countryEn: 'Saudi Arabia', timezone: 'Asia/Riyadh' },
  { prefix: '967', country: '也门', timezone: 'Asia/Aden' },
  { prefix: '968', country: '阿曼', countryEn: 'Oman', timezone: 'Asia/Muscat' },
  { prefix: '970', country: '巴勒斯坦', timezone: 'Asia/Gaza' },
  { prefix: '971', country: '阿联酋', countryEn: 'UAE', timezone: 'Asia/Dubai' },
  { prefix: '972', country: '以色列', timezone: 'Asia/Jerusalem' },
  { prefix: '973', country: '巴林', countryEn: 'Bahrain', timezone: 'Asia/Bahrain' },
  { prefix: '974', country: '卡塔尔', countryEn: 'Qatar', timezone: 'Asia/Qatar' },
  { prefix: '977', country: '尼泊尔', countryEn: 'Nepal', timezone: 'Asia/Kathmandu' },
  { prefix: '960', country: '马尔代夫', timezone: 'Indian/Maldives' },
  { prefix: '975', country: '不丹', timezone: 'Asia/Thimphu' },
  { prefix: '976', country: '蒙古', timezone: 'Asia/Ulaanbaatar' },
  { prefix: '992', country: '塔吉克斯坦', timezone: 'Asia/Dushanbe' },
  { prefix: '993', country: '土库曼斯坦', timezone: 'Asia/Ashgabat' },
  { prefix: '994', country: '阿塞拜疆', timezone: 'Asia/Baku' },
  { prefix: '995', country: '格鲁吉亚', timezone: 'Asia/Tbilisi' },
  { prefix: '996', country: '吉尔吉斯斯坦', timezone: 'Asia/Bishkek' },
  { prefix: '998', country: '乌兹别克斯坦', timezone: 'Asia/Tashkent' },
  { prefix: '220', country: '冈比亚', timezone: 'Africa/Banjul' },
  { prefix: '222', country: '毛里塔尼亚', timezone: 'Africa/Nouakchott' },
  { prefix: '223', country: '马里', timezone: 'Africa/Bamako' },
  { prefix: '224', country: '几内亚', timezone: 'Africa/Conakry' },
  { prefix: '226', country: '布基纳法索', timezone: 'Africa/Ouagadougou' },
  { prefix: '227', country: '尼日尔', timezone: 'Africa/Niamey' },
  { prefix: '228', country: '多哥', timezone: 'Africa/Lome' },
  { prefix: '229', country: '贝宁', countryEn: 'Benin', timezone: 'Africa/Porto-Novo' },
  { prefix: '230', country: '毛里求斯', countryEn: 'Mauritius', timezone: 'Indian/Mauritius' },
  { prefix: '231', country: '利比里亚', timezone: 'Africa/Monrovia' },
  { prefix: '232', country: '塞拉利昂', timezone: 'Africa/Freetown' },
  { prefix: '234', country: '尼日利亚', countryEn: 'Nigeria', timezone: 'Africa/Lagos' },
  { prefix: '233', country: '加纳', timezone: 'Africa/Accra' },
  { prefix: '225', country: '科特迪瓦', timezone: 'Africa/Abidjan' },
  { prefix: '221', country: '塞内加尔', timezone: 'Africa/Dakar' },
  { prefix: '237', country: '喀麦隆', timezone: 'Africa/Douala' },
  { prefix: '235', country: '乍得', timezone: 'Africa/Ndjamena' },
  { prefix: '236', country: '中非共和国', timezone: 'Africa/Bangui' },
  { prefix: '238', country: '佛得角', timezone: 'Atlantic/Cape_Verde' },
  { prefix: '239', country: '圣多美和普林西比', timezone: 'Africa/Sao_Tome' },
  { prefix: '240', country: '赤道几内亚', timezone: 'Africa/Malabo' },
  { prefix: '241', country: '加蓬', timezone: 'Africa/Libreville' },
  { prefix: '242', country: '刚果（布）', timezone: 'Africa/Brazzaville' },
  { prefix: '243', country: '刚果（金）', timezone: 'Africa/Kinshasa' },
  { prefix: '244', country: '安哥拉', timezone: 'Africa/Luanda' },
  { prefix: '245', country: '几内亚比绍', timezone: 'Africa/Bissau' },
  { prefix: '248', country: '塞舌尔', timezone: 'Indian/Mahe' },
  { prefix: '249', country: '苏丹', timezone: 'Africa/Khartoum' },
  { prefix: '250', country: '卢旺达', timezone: 'Africa/Kigali' },
  { prefix: '251', country: '埃塞俄比亚', timezone: 'Africa/Addis_Ababa' },
  { prefix: '254', country: '肯尼亚', timezone: 'Africa/Nairobi' },
  { prefix: '255', country: '坦桑尼亚', timezone: 'Africa/Dar_es_Salaam' },
  { prefix: '256', country: '乌干达', timezone: 'Africa/Kampala' },
  { prefix: '257', country: '布隆迪', timezone: 'Africa/Bujumbura' },
  { prefix: '258', country: '莫桑比克', timezone: 'Africa/Maputo' },
  { prefix: '260', country: '赞比亚', timezone: 'Africa/Lusaka' },
  { prefix: '261', country: '马达加斯加', timezone: 'Indian/Antananarivo' },
  { prefix: '263', country: '津巴布韦', timezone: 'Africa/Harare' },
  { prefix: '264', country: '纳米比亚', timezone: 'Africa/Windhoek' },
  { prefix: '265', country: '马拉维', timezone: 'Africa/Blantyre' },
  { prefix: '266', country: '莱索托', timezone: 'Africa/Maseru' },
  { prefix: '267', country: '博茨瓦纳', timezone: 'Africa/Gaborone' },
  { prefix: '268', country: '斯威士兰', timezone: 'Africa/Mbabane' },
  { prefix: '269', country: '科摩罗', timezone: 'Indian/Comoro' },
  { prefix: '291', country: '厄立特里亚', timezone: 'Africa/Asmara' },
  { prefix: '212', country: '摩洛哥', timezone: 'Africa/Casablanca' },
  { prefix: '213', country: '阿尔及利亚', timezone: 'Africa/Algiers' },
  { prefix: '216', country: '突尼斯', timezone: 'Africa/Tunis' },
  { prefix: '218', country: '利比亚', timezone: 'Africa/Tripoli' },
  { prefix: '351', country: '葡萄牙', timezone: 'Europe/Lisbon' },
  { prefix: '350', country: '直布罗陀', timezone: 'Europe/Gibraltar' },
  { prefix: '352', country: '卢森堡', timezone: 'Europe/Luxembourg' },
  { prefix: '353', country: '爱尔兰', timezone: 'Europe/Dublin' },
  { prefix: '354', country: '冰岛', timezone: 'Atlantic/Reykjavik' },
  { prefix: '355', country: '阿尔巴尼亚', timezone: 'Europe/Tirane' },
  { prefix: '356', country: '马耳他', timezone: 'Europe/Malta' },
  { prefix: '357', country: '塞浦路斯', timezone: 'Asia/Nicosia' },
  { prefix: '358', country: '芬兰', timezone: 'Europe/Helsinki' },
  { prefix: '359', country: '保加利亚', timezone: 'Europe/Sofia' },
  { prefix: '370', country: '立陶宛', timezone: 'Europe/Vilnius' },
  { prefix: '371', country: '拉脱维亚', timezone: 'Europe/Riga' },
  { prefix: '372', country: '爱沙尼亚', timezone: 'Europe/Tallinn' },
  { prefix: '373', country: '摩尔多瓦', timezone: 'Europe/Chisinau' },
  { prefix: '374', country: '亚美尼亚', timezone: 'Asia/Yerevan' },
  { prefix: '375', country: '白俄罗斯', timezone: 'Europe/Minsk' },
  { prefix: '376', country: '安道尔', timezone: 'Europe/Andorra' },
  { prefix: '377', country: '摩纳哥', timezone: 'Europe/Monaco' },
  { prefix: '378', country: '圣马力诺', timezone: 'Europe/San_Marino' },
  { prefix: '380', country: '乌克兰', timezone: 'Europe/Kyiv' },
  { prefix: '381', country: '塞尔维亚', timezone: 'Europe/Belgrade' },
  { prefix: '382', country: '黑山', timezone: 'Europe/Podgorica' },
  { prefix: '383', country: '科索沃', timezone: 'Europe/Belgrade' },
  { prefix: '385', country: '克罗地亚', timezone: 'Europe/Zagreb' },
  { prefix: '386', country: '斯洛文尼亚', timezone: 'Europe/Ljubljana' },
  { prefix: '387', country: '波黑', timezone: 'Europe/Sarajevo' },
  { prefix: '389', country: '北马其顿', timezone: 'Europe/Skopje' },
  { prefix: '420', country: '捷克', timezone: 'Europe/Prague' },
  { prefix: '421', country: '斯洛伐克', timezone: 'Europe/Bratislava' },
  { prefix: '423', country: '列支敦士登', timezone: 'Europe/Vaduz' },
  { prefix: '20', country: '埃及', timezone: 'Africa/Cairo' },
  { prefix: '27', country: '南非', timezone: 'Africa/Johannesburg' },
  { prefix: '30', country: '希腊', timezone: 'Europe/Athens' },
  { prefix: '31', country: '荷兰', timezone: 'Europe/Amsterdam' },
  { prefix: '32', country: '比利时', timezone: 'Europe/Brussels' },
  { prefix: '33', country: '法国', timezone: 'Europe/Paris' },
  { prefix: '34', country: '西班牙', timezone: 'Europe/Madrid' },
  { prefix: '36', country: '匈牙利', timezone: 'Europe/Budapest' },
  { prefix: '39', country: '意大利', timezone: 'Europe/Rome' },
  { prefix: '40', country: '罗马尼亚', timezone: 'Europe/Bucharest' },
  { prefix: '41', country: '瑞士', timezone: 'Europe/Zurich' },
  { prefix: '43', country: '奥地利', timezone: 'Europe/Vienna' },
  { prefix: '44', country: '英国', countryEn: 'United Kingdom', timezone: 'Europe/London' },
  { prefix: '45', country: '丹麦', timezone: 'Europe/Copenhagen' },
  { prefix: '46', country: '瑞典', timezone: 'Europe/Stockholm' },
  { prefix: '47', country: '挪威', timezone: 'Europe/Oslo' },
  { prefix: '48', country: '波兰', timezone: 'Europe/Warsaw' },
  { prefix: '49', country: '德国', countryEn: 'Germany', timezone: 'Europe/Berlin' },
  { prefix: '53', country: '古巴', countryEn: 'Cuba', timezone: 'America/Havana' },
  { prefix: '51', country: '秘鲁', timezone: 'America/Lima' },
  { prefix: '52', country: '墨西哥', timezone: 'America/Mexico_City' },
  { prefix: '54', country: '阿根廷', timezone: 'America/Argentina/Buenos_Aires' },
  { prefix: '55', country: '巴西', countryEn: 'Brazil', timezone: 'America/Sao_Paulo' },
  { prefix: '56', country: '智利', timezone: 'America/Santiago' },
  { prefix: '57', country: '哥伦比亚', timezone: 'America/Bogota' },
  { prefix: '58', country: '委内瑞拉', timezone: 'America/Caracas' },
  { prefix: '501', country: '伯利兹', timezone: 'America/Belize' },
  { prefix: '502', country: '危地马拉', timezone: 'America/Guatemala' },
  { prefix: '503', country: '萨尔瓦多', timezone: 'America/El_Salvador' },
  { prefix: '504', country: '洪都拉斯', timezone: 'America/Tegucigalpa' },
  { prefix: '505', country: '尼加拉瓜', timezone: 'America/Managua' },
  { prefix: '506', country: '哥斯达黎加', timezone: 'America/Costa_Rica' },
  { prefix: '507', country: '巴拿马', timezone: 'America/Panama' },
  { prefix: '509', country: '海地', timezone: 'America/Port-au-Prince' },
  { prefix: '591', country: '玻利维亚', timezone: 'America/La_Paz' },
  { prefix: '592', country: '圭亚那', timezone: 'America/Guyana' },
  { prefix: '593', country: '厄瓜多尔', timezone: 'America/Guayaquil' },
  { prefix: '595', country: '巴拉圭', timezone: 'America/Asuncion' },
  { prefix: '597', country: '苏里南', timezone: 'America/Paramaribo' },
  { prefix: '598', country: '乌拉圭', timezone: 'America/Montevideo' },
  { prefix: '60', country: '马来西亚', countryEn: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
  { prefix: '61', country: '澳大利亚', countryEn: 'Australia', timezone: 'Australia/Sydney' },
  { prefix: '62', country: '印尼', countryEn: 'Indonesia', timezone: 'Asia/Jakarta' },
  { prefix: '63', country: '菲律宾', countryEn: 'Philippines', timezone: 'Asia/Manila' },
  { prefix: '64', country: '新西兰', timezone: 'Pacific/Auckland' },
  { prefix: '65', country: '新加坡', countryEn: 'Singapore', timezone: 'Asia/Singapore' },
  { prefix: '66', country: '泰国', countryEn: 'Thailand', timezone: 'Asia/Bangkok' },
  { prefix: '81', country: '日本', countryEn: 'Japan', timezone: 'Asia/Tokyo' },
  { prefix: '82', country: '韩国', countryEn: 'South Korea', timezone: 'Asia/Seoul' },
  { prefix: '84', country: '越南', countryEn: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
  { prefix: '86', country: '中国', countryEn: 'China', timezone: 'Asia/Shanghai' },
  { prefix: '90', country: '土耳其', countryEn: 'Türkiye', timezone: 'Europe/Istanbul' },
  { prefix: '91', country: '印度', countryEn: 'India', timezone: 'Asia/Kolkata' },
  { prefix: '92', country: '巴基斯坦', countryEn: 'Pakistan', timezone: 'Asia/Karachi' },
  { prefix: '93', country: '阿富汗', timezone: 'Asia/Kabul' },
  { prefix: '94', country: '斯里兰卡', countryEn: 'Sri Lanka', timezone: 'Asia/Colombo' },
  { prefix: '95', country: '缅甸', countryEn: 'Myanmar', timezone: 'Asia/Yangon' },
  { prefix: '98', country: '伊朗', timezone: 'Asia/Tehran' },
  { prefix: '7', country: '俄罗斯', timezone: 'Europe/Moscow' },
  // Country code +1 alone spans many countries and timezones. Never invent a
  // New York time when the geographic area code is unknown.
  { prefix: '1', country: '北美号码区', countryEn: 'North American Numbering Plan', timezone: '' },
].sort((a, b) => b.prefix.length - a.prefix.length);

const FLAG_HINTS: Array<RegionInfo & { flag: string; iso?: string }> = [
  { flag: '🇱🇰', country: '斯里兰卡', countryEn: 'Sri Lanka', timezone: 'Asia/Colombo', iso: 'LK' },
  { flag: '🇧🇳', country: '文莱', countryEn: 'Brunei', timezone: 'Asia/Brunei', iso: 'BN' },
  { flag: '🇧🇩', country: '孟加拉', countryEn: 'Bangladesh', timezone: 'Asia/Dhaka', iso: 'BD' },
  { flag: '🇮🇶', country: '伊拉克', countryEn: 'Iraq', timezone: 'Asia/Baghdad', iso: 'IQ' },
  { flag: '🇰🇼', country: '科威特', timezone: 'Asia/Kuwait', iso: 'KW' },
  { flag: '🇶🇦', country: '卡塔尔', timezone: 'Asia/Qatar', iso: 'QA' },
  { flag: '🇧🇭', country: '巴林', timezone: 'Asia/Bahrain', iso: 'BH' },
  { flag: '🇴🇲', country: '阿曼', timezone: 'Asia/Muscat', iso: 'OM' },
  { flag: '🇯🇴', country: '约旦', timezone: 'Asia/Amman', iso: 'JO' },
  { flag: '🇱🇧', country: '黎巴嫩', timezone: 'Asia/Beirut', iso: 'LB' },
  { flag: '🇦🇪', country: '阿联酋', countryEn: 'UAE', timezone: 'Asia/Dubai', iso: 'AE' },
  { flag: '🇸🇦', country: '沙特', timezone: 'Asia/Riyadh', iso: 'SA' },
  { flag: '🇮🇳', country: '印度', countryEn: 'India', timezone: 'Asia/Kolkata', iso: 'IN' },
  { flag: '🇵🇰', country: '巴基斯坦', timezone: 'Asia/Karachi', iso: 'PK' },
  { flag: '🇮🇩', country: '印尼', timezone: 'Asia/Jakarta', iso: 'ID' },
  { flag: '🇻🇳', country: '越南', timezone: 'Asia/Ho_Chi_Minh', iso: 'VN' },
  { flag: '🇹🇭', country: '泰国', timezone: 'Asia/Bangkok', iso: 'TH' },
  { flag: '🇲🇾', country: '马来西亚', timezone: 'Asia/Kuala_Lumpur', iso: 'MY' },
  { flag: '🇸🇬', country: '新加坡', timezone: 'Asia/Singapore', iso: 'SG' },
  { flag: '🇵🇭', country: '菲律宾', timezone: 'Asia/Manila', iso: 'PH' },
  { flag: '🇨🇳', country: '中国', timezone: 'Asia/Shanghai', iso: 'CN' },
  { flag: '🇯🇵', country: '日本', timezone: 'Asia/Tokyo', iso: 'JP' },
  { flag: '🇰🇷', country: '韩国', timezone: 'Asia/Seoul', iso: 'KR' },
  { flag: '🇺🇸', country: '美国', timezone: 'America/New_York', iso: 'US' },
  { flag: '🇬🇧', country: '英国', timezone: 'Europe/London', iso: 'GB' },
  { flag: '🇩🇪', country: '德国', timezone: 'Europe/Berlin', iso: 'DE' },
  { flag: '🇹🇷', country: '土耳其', timezone: 'Europe/Istanbul', iso: 'TR' },
  { flag: '🇪🇬', country: '埃及', timezone: 'Africa/Cairo', iso: 'EG' },
  { flag: '🇧🇷', country: '巴西', timezone: 'America/Sao_Paulo', iso: 'BR' },
  { flag: '🇲🇲', country: '缅甸', timezone: 'Asia/Yangon', iso: 'MM' },
  { flag: '🇰🇭', country: '柬埔寨', timezone: 'Asia/Phnom_Penh', iso: 'KH' },
  { flag: '🇱🇦', country: '老挝', timezone: 'Asia/Vientiane', iso: 'LA' },
  { flag: '🇹🇼', country: '台湾', timezone: 'Asia/Taipei', iso: 'TW' },
  { flag: '🇭🇰', country: '香港', timezone: 'Asia/Hong_Kong', iso: 'HK' },
  { flag: '🇦🇺', country: '澳大利亚', timezone: 'Australia/Sydney', iso: 'AU' },
  { flag: '🇳🇵', country: '尼泊尔', countryEn: 'Nepal', timezone: 'Asia/Kathmandu', iso: 'NP' },
  { flag: '🇩🇿', country: '阿尔及利亚', countryEn: 'Algeria', timezone: 'Africa/Algiers', iso: 'DZ' },
  { flag: '🇧🇯', country: '贝宁', countryEn: 'Benin', timezone: 'Africa/Porto-Novo', iso: 'BJ' },
  { flag: '🇳🇬', country: '尼日利亚', countryEn: 'Nigeria', timezone: 'Africa/Lagos', iso: 'NG' },
  { flag: '🇲🇺', country: '毛里求斯', countryEn: 'Mauritius', timezone: 'Indian/Mauritius', iso: 'MU' },
];

interface CountryNameHint extends RegionInfo {
  aliases: string[];
}

const EXTRA_COUNTRY_ALIASES: Record<string, string[]> = {
  '美国/加拿大': ['美国', '加拿大', 'United States', 'USA', 'Canada'],
  阿联酋: ['United Arab Emirates'],
  沙特: ['Saudi Arabia'],
  印尼: ['Indonesia'],
};

/**
 * Saved contacts often hide the phone number, while sales teams put the market
 * in the display name. Reuse the complete dialing table for Chinese names and
 * its curated English names; ASCII aliases require word boundaries below.
 */
const COUNTRY_NAME_HINTS: CountryNameHint[] = COUNTRY_PREFIXES.map((item) => ({
  aliases: [
    item.country,
    ...(item.countryEn ? [item.countryEn] : []),
    ...(EXTRA_COUNTRY_ALIASES[item.country] ?? []),
  ],
  country: item.country,
  countryEn: item.countryEn,
  timezone: item.timezone,
}));

const countryNameCache = new Map<string, string>();

const ISO_TO_REGION = createIsoToRegionMap();

function displayCountryName(iso: string, locale: 'en' | 'zh-CN'): string {
  const key = `${locale}:${iso}`;
  const cached = countryNameCache.get(key);
  if (cached) return cached;
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? iso;
    countryNameCache.set(key, name);
    return name;
  } catch {
    return iso;
  }
}

function createIsoToRegionMap(): Map<string, RegionInfo> {
  const countries = getCountries();
  const callingCodeCounts = new Map<string, number>();
  for (const iso of countries) {
    const code = getCountryCallingCode(iso);
    callingCodeCounts.set(code, (callingCodeCounts.get(code) ?? 0) + 1);
  }

  const result = new Map<string, RegionInfo>();
  for (const iso of countries) {
    const code = getCountryCallingCode(iso);
    const region = COUNTRY_PREFIXES.find((item) => item.prefix === code);
    // A flag identifies the country but not the sub-region. Use a timezone only
    // when its calling code belongs to a single metadata country.
    const timezone = callingCodeCounts.get(code) === 1 ? region?.timezone ?? '' : '';
    result.set(iso, {
      country: displayCountryName(iso, 'zh-CN'),
      countryEn: displayCountryName(iso, 'en'),
      timezone,
    });
  }

  // Curated entries may safely add a useful default timezone for common flags.
  for (const item of FLAG_HINTS) {
    if (!item.iso) continue;
    result.set(item.iso, {
      country: item.country,
      countryEn: item.countryEn || displayCountryName(item.iso, 'en'),
      timezone: item.timezone,
    });
  }
  return result;
}

function countryNamesFromPhone(phone: string): { country: string; countryEn: string } | null {
  try {
    const iso = parsePhoneNumberFromString(`+${phone}`)?.country;
    if (!iso) return null;
    return {
      country: displayCountryName(iso, 'zh-CN'),
      countryEn: displayCountryName(iso, 'en'),
    };
  } catch {
    return null;
  }
}

function findCountryByPhone(phone: string): RegionInfo | null {
  const metadataNames = countryNamesFromPhone(phone);
  for (const item of COUNTRY_PREFIXES) {
    if (!phone.startsWith(item.prefix)) continue;
    return {
      ...item,
      // The maintained numbering metadata disambiguates shared calling codes
      // and supplies a consistent English display name.
      country: metadataNames?.country ?? item.country,
      countryEn: metadataNames?.countryEn ?? item.countryEn,
    };
  }
  // A newly assigned country code should still show its country immediately;
  // the UI will mark the timezone as pending until a reliable mapping exists.
  return metadataNames ? { ...metadataNames, timezone: '' } : null;
}

function findCountryByFlag(text: string): RegionInfo | null {
  if (!text) return null;
  for (const item of FLAG_HINTS) {
    if (text.includes(item.flag)) {
      return {
        ...item,
        countryEn: item.countryEn || (item.iso ? displayCountryName(item.iso, 'en') : undefined),
      };
    }
  }
  // Regional indicator pairs (🇹🇭 → TH) survive better than emoji string compare.
  try {
    const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
    if (match?.[0]) {
      const iso = [...match[0]]
        .map((ch) => {
          const cp = ch.codePointAt(0);
          if (!cp) return '';
          return String.fromCharCode(cp - 0x1f1e6 + 65);
        })
        .join('');
      const hit = ISO_TO_REGION.get(iso);
      if (hit) return hit;
    }
  } catch {
    // older engines without unicode property escapes
  }
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsCountryAlias(text: string, alias: string): boolean {
  if (!alias) return false;
  if (/^[\x00-\x7F]+$/.test(alias)) {
    return new RegExp(`(?:^|[^A-Za-z])${escapeRegExp(alias)}(?:$|[^A-Za-z])`, 'i').test(text);
  }
  return text.includes(alias);
}

function findCountryByName(text: string): RegionInfo | null {
  if (!text) return null;
  for (const hint of COUNTRY_NAME_HINTS) {
    if (hint.aliases.some((alias) => containsCountryAlias(text, alias))) return hint;
  }
  return null;
}

function extractDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

function pickPhoneCandidate(...candidates: Array<string | null | undefined>): string {
  for (const raw of candidates) {
    if (!raw) continue;
    const digits = extractDigits(raw);
    if (digits.length >= 8 && digits.length <= 15) return digits;
  }
  return '';
}

function formatLocalTime(timezone: string): { localTime: string; localHour: number } {
  try {
    const localTime = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    const hourText =
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date())
        .find((part) => part.type === 'hour')?.value ?? '0';
    return { localTime, localHour: Number(hourText) };
  } catch {
    const now = new Date();
    return {
      localTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      localHour: now.getHours(),
    };
  }
}

export function getPhoneInsights(input: {
  chatId?: string | null;
  title?: string;
  headerPhone?: string | null;
  manualPhone?: string;
}): PhoneInsights {
  const chatPhone = input.chatId?.startsWith('phone:')
    ? input.chatId.slice('phone:'.length)
    : '';
  const titleDigits = (input.title ?? '').match(/\+?\d[\d\s-]{7,}\d/)?.[0] ?? '';
  // 优先使用手动输入的号码
  const phone = input.manualPhone
    ? input.manualPhone
    : pickPhoneCandidate(input.headerPhone, chatPhone, titleDigits);

  const flagHint = findCountryByFlag(input.title ?? '');
  const byPhone = phone ? findCountryByPhone(phone) : null;
  const nameHint = findCountryByName(input.title ?? '');
  // The saved contact's real phone prefix is authoritative. Flags and names are
  // presentation metadata and only act as fallbacks when WhatsApp has no PN.
  const region = byPhone ?? flagHint ?? nameHint;
  const regionSource = byPhone
    ? 'phone'
    : flagHint
      ? 'flag'
      : nameHint
        ? 'name'
        : 'none';
  const regionSourceLabel = {
    phone: '电话号码',
    flag: '国家旗帜',
    name: '联系人名称',
    none: '未知',
  }[regionSource];

  if (!phone && !region) {
    return {
      phone: '',
      hasRealPhone: false,
      country: '',
      countryEn: '',
      regionSource: 'none',
      regionSourceLabel: '未知',
      timezone: '',
      localTime: '',
      workingHint: '',
      available: false,
      fallbackText: '未识别到号码（可用 popup 开聊带号码）',
    };
  }

  const timezone = region?.timezone ?? '';
  const country = region?.country ?? '未知地区';
  const countryEn = region?.countryEn ?? country;
  const time = timezone ? formatLocalTime(timezone) : null;
  const isWorking = time ? time.localHour >= 9 && time.localHour < 18 : false;

  return {
    phone,
    hasRealPhone: Boolean(phone),
    country,
    countryEn,
    regionSource,
    regionSourceLabel,
    timezone,
    localTime: time?.localTime ?? '',
    workingHint: time
      ? isWorking
        ? '工作中 09:00-18:00'
        : '休息中 09:00-18:00'
      : '',
    available: true,
  };
}

export function formatHeaderInsightLabel(insights: PhoneInsights): string {
  if (!insights.available) return '';
  if (!insights.country || insights.country === '未知地区') return '';
  return `${insights.countryEn || insights.country} · ${insights.localTime || '时区待识别'}`;
}

/** @deprecated use getPhoneInsights */
export function getPhoneInsightsFromChatId(chatId: string | null): PhoneInsights {
  return getPhoneInsights({ chatId });
}
