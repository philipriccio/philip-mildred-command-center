import { test, expect } from '@playwright/test';

const apiBase = 'http://127.0.0.1:3001';
const appBase = 'http://127.0.0.1:5174';

test('office first live ops flow', async ({ page, request }) => {
  const unique = Date.now();
  const working = await request.post(`${apiBase}/api/tasks`, { data: {
    title: `Working task ${unique}`,
    request_summary: 'Ship the office-first homepage update',
    progress_summary: 'Built the fixed desks and clearer states.',
    next_step: 'Open the detail panel and review copy.',
    model_used: 'MiniMax M2.5',
    status: 'in_progress',
    agent_id: 'dev',
    lane_id: 'hawco'
  }});
  expect(working.ok()).toBeTruthy();
  const workingTask = await working.json();

  const blocked = await request.post(`${apiBase}/api/tasks`, { data: {
    title: `Blocked task ${unique}`,
    request_summary: 'Review approval gate behaviour',
    progress_summary: 'Mapped pending reports into the tray.',
    next_step: 'Waiting for Mildred approval copy.',
    model_used: 'GPT-5.4',
    status: 'in_progress',
    agent_id: 'mildred',
    lane_id: 'personal',
    blocker_reason: 'Waiting on Mildred review notes.'
  }});
  expect(blocked.ok()).toBeTruthy();

  const pending = await request.post(`${apiBase}/api/tasks`, { data: {
    title: `Pending report ${unique}`,
    request_summary: 'Prepare a trusted archive report',
    progress_summary: 'Drafted the final summary.',
    next_step: 'Await Mildred review.',
    completion_summary: 'The report is ready for Mildred review.',
    model_used: 'Claude 4.5',
    status: 'complete',
    agent_id: 'content',
    lane_id: 'company-theatre'
  }});
  expect(pending.ok()).toBeTruthy();
  const pendingTask = await pending.json();

  await page.goto(appBase, { waitUntil: 'networkidle' });
  await expect(page.getByText('Office status map')).toBeVisible();
  await expect(page.getByText('Default home view')).toBeVisible();
  await expect(page.getByText('Dev')).toBeVisible();
  await expect(page.getByText('Mildred')).toBeVisible();
  await expect(page.getByText('Content')).toBeVisible();
  await expect(page.getByText('Research')).toBeVisible();
  await expect(page.getByText('Blocked', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Open task detail' }).first().click();
  await expect(page.getByText('Plain-English task detail')).toBeVisible();
  await expect(page.getByText('Model being used')).toBeVisible();
  await expect(page.getByText('MiniMax M2.5')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).first().click();

  await page.getByRole('button', { name: /Reports Tray/ }).click();
  await expect(page.getByText('Awaiting Mildred review')).toBeVisible();
  await expect(page.getByText(`Pending report ${unique}`)).toBeVisible();
  await page.getByRole('button', { name: 'Mark reviewed and approved by Mildred' }).click();
  await expect(page.getByText('Approved reports')).toBeVisible();
  await expect(page.getByText('Approved by: Mildred')).toBeVisible();

  await request.delete(`${apiBase}/api/tasks/${workingTask.id}`);
  await request.delete(`${apiBase}/api/tasks/${pendingTask.id}`);
});
