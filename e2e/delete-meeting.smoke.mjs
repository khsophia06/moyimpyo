import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:973,height:871}});
let deletes=0, fail=true;
const meeting={id:'delete-ui-fixture',title:'삭제 확인용 모임',startDate:'2026-10-03',duration:120,revision:1};
await page.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(req.method()==='DELETE') {deletes++;expect(req.postDataJSON()).toEqual({revision:1});await route.fulfill({status:fail?503:200,json:fail?{error:'다시 시도해 주세요.'}:{ok:true}});return;}
 await route.fulfill({json:url.pathname==='/api/me'?{user:{id:'fixture-owner',name:'주최자'}}:[meeting]});
});
try {
 await page.goto('http://localhost:3000/');
 await expect(page.getByText('시간/장소를 쉽고 빠르게 정해요')).toBeVisible();
 await page.getByRole('button',{name:'삭제 확인용 모임 모임 삭제'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('button',{name:'취소',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'취소',exact:true}).click();
 expect(deletes).toBe(0);
 await page.getByRole('button',{name:'삭제 확인용 모임 모임 삭제'}).click();
 await page.getByRole('button',{name:'삭제하기',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('다시 시도해 주세요.');
 fail=false;
 await page.getByRole('button',{name:'삭제하기',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText('0개의 모임')).toBeVisible();
 await page.goto('http://localhost:3000/new');
 await expect(page.getByText('시간만 정하기',{exact:true})).toBeVisible();
 await expect(page.getByText('장소 없이 모임 시간만 함께 정해요')).toBeVisible();
 await expect(page.getByText('한국 시간 · UTC+9',{exact:true})).toHaveCount(0);
 console.log('PASS: deletion cancel, error/retry, list update, and form copy');
} finally { await browser.close(); }
