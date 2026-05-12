import {CoreModule, JestLib, setupDevKernel, TestContext, TestKernel,} from '@grandlinex/core';
import { PGCon } from '../src/index.js';

const appName = 'TestKernel';
const appCode = 'tkernel';
const [kernel] = TestContext.getEntity(
    {
      kernel:new TestKernel(appName, appCode, __dirname),
      cleanUp:true
    }
);

setupDevKernel(kernel, (mod) => {
  return {
    db: new PGCon(mod, '0'),
    // db: new InMemDB(mod),
  };
});

kernel.setBaseModule(new CoreModule(kernel,(mod)=> new PGCon(mod,"0")))
 jest.setTimeout(15000);
 JestLib.jestStart();
 JestLib.jestCore();
 JestLib.jestDb();
 JestLib.jestEnd();
 JestLib.jestOrm();
