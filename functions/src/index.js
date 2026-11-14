import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {createService} from './service.js';
initializeApp();
const service=createService({db:getFirestore(),auth:getAuth(),bucket:getStorage().bucket()});
export const api=onRequest({region:'asia-south1',maxInstances:5,minInstances:0,concurrency:10,memory:'512MiB',timeoutSeconds:120},service.app);
// Retry tombstoned deletion jobs after transient Auth/Storage failures.
export const cleanup=onSchedule({schedule:'every 60 minutes',region:'asia-south1',maxInstances:1},()=>service.cleanup());
