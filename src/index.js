const axios = require('axios');
const argv = require('yargs').argv;
const querystring = require('querystring');

function get(url) {
  return axios.default
    .request({
      headers: {
        referer: 'https://www.microsoftstore.com.cn/student/edu-refurbished-surface',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36',
      },
      url,
      method: 'GET',
    })
    .then(res => res.data);
}

function sleep(sleepTime) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, sleepTime);
  });
}

function weixinNotify(key, logDesc, logDesp) {
  const data = {
    text: logDesc,
    desp: logDesp,
  };
  const dataStr = querystring.stringify(data);
  return axios.default.post(`https://sc.ftqq.com/${key}.send`, dataStr).then(res => res.data);
}

function formatDate(date, fmt) {
  const o = {
    'y+': date.getFullYear(), // 年份
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'h+': date.getHours() % 12 === 0 ? 12 : date.getHours() % 12, // 12小时制
    'H+': date.getHours(), // 24小时制
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds(), // 秒
    'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
    'f+': date.getMilliseconds(), // 毫秒
  };
  for (const k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(RegExp.$1, o[k].toString().padStart(RegExp.$1.length, '0'));
    }
  }
  return fmt;
}

async function run(wantToBuyProductNameRegex = /Surface Go/, sizeRegex = /128GB/) {
  while (true) {
    try {
      const dateNow = new Date();
      if (dateNow.getMinutes() === 59) {
        break;
      }
      console.group(formatDate(dateNow, 'yyyy/MM/dd HH:mm:ss fff : '));
      const result = await get(
        `https://www.microsoftstore.com.cn/graphql?query=%7B+categoryList(filters%3A+%7Bids%3A+%7Bin%3A+%5B%2267%22%5D%7D%7D)+%7B+id+name+absolute_path+store+price_sort+products(pageSize%3A100)+%7B+total_count+items%7B+id+sku+name+image+%7B+label+url+%7D+private_price+qty_status+super_attribute+%7B+code+label+index+%7D+...+on+ConfigurableProduct+%7B+variants+%7B+attributes+%7B+code+label+value_index+%7D+product+%7B+id+sku+name+sub_name+image+%7B+label+url+%7D+private_price+qty_status+color+size+%7D+%7D+%7D+%7D+%7D+%7D+%7D&_=${Date.now()}`
      );
      const products = result.data.categoryList[0].products.items;
      if (products && products.length > 0) {
        // 当前可买的,按价格从低到高
        console.clear();
        let isAlreadyNotify = false;
        products
          .map(x => x.variants)
          .reduce((acc, cur) => acc.concat(cur), [])
          .filter(x => x.product.private_price && x.product.qty_status === 'true')
          .sort((a, b) => Number(a.product.private_price.replace('￥ ', '').replace(',', '')) - Number(b.product.private_price.replace('￥ ', '').replace(',', '')))
          .forEach(x => console.log(`${x.product.name} ${x.product.sub_name}  :   ${x.product.private_price}`));
        const wantToBuyProducts = products.filter(x => wantToBuyProductNameRegex.test(x.name));
        if (wantToBuyProducts && wantToBuyProducts.length > 0) {
          for (const wantToBuyProduct of wantToBuyProducts) {
            if (wantToBuyProduct.variants && wantToBuyProduct.variants.length > 0) {
              let canBuyProducts = wantToBuyProduct.variants.filter(x => x.product.qty_status === 'true');
              if (canBuyProducts.length > 0 && sizeRegex) {
                canBuyProducts = canBuyProducts.filter(x => sizeRegex.test(x.product.sub_name));
              }
              if (canBuyProducts.length > 0) {
                let notifyMsg = `####  ${wantToBuyProduct.name} 已到货：\r\n\r\n${canBuyProducts.map(x => `> ${x.product.sub_name} ${x.product.private_price}`).join('\r\n\r\n')}`; //`${wantToBuyProduct.name} 已到货:\r\n${canBuyProducts.map(x => `${x.product.sub_name} ${x.product.private_price}`).join('\r\n')}`;
                console.group('notifyMsg : ');
                console.log(notifyMsg);
                console.groupEnd();
                const notifyResult = await weixinNotify(argv.wxkey, '微软教育优惠到货通知', notifyMsg);
                console.log(`notifyResult : `, notifyResult);
                isAlreadyNotify = true;
              }
            }
          }
        }
        if (isAlreadyNotify) {
          break;
        }
      } else {
        break;
      }
      console.groupEnd();
    } catch (error) {
      console.error(error);
    }
    await sleep(Math.random() * 1000);
  }
}

run(/Surface Go|Surface Pro 6/, /4415Y\/8GB\/128GB|i7\/16GB\/512GB/);
