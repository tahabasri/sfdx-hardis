import c from 'chalk';
import fs from 'fs-extra';
import * as path from 'path';
import { execCommand, uxLog } from './index.js';
import { glob } from 'glob';
import { parseXmlFile } from './xmlUtils.js';

export const GLOB_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/cache/**',
  '**/.npm/**',
  '**/logs/**',
  '**/.sfdx/**',
  '**/.sf/**',
  '**/.vscode/**',
];

export function isSfdxProject(cwd = process.cwd()) {
  return fs.existsSync(path.join(cwd, 'sfdx-project.json'));
}

export async function createBlankSfdxProject(cwd = process.cwd(), debug = false) {
  uxLog(this, c.cyan('Creating blank SFDX project...'));
  const projectCreateCommand = 'sf project generate --name "sfdx-hardis-blank-project"';
  await execCommand(projectCreateCommand, this, {
    cwd: cwd,
    fail: true,
    debug: debug,
    output: true,
  });
  return path.join(cwd, "sfdx-hardis-blank-project");
}

export async function listFlowFiles(packageDirs) {
  const flowFiles: any[] = [];
  const skippedFlows: string[] = [];
  for (const packageDir of packageDirs || []) {
    const flowMetadatas = await glob("**/*.flow-meta.xml", { cwd: packageDir.path, ignore: GLOB_IGNORE_PATTERNS });
    for (const flowMetadata of flowMetadatas) {
      const flowFile = path.join(packageDir.path, flowMetadata).replace(/\\/g, '/');
      if (await isManagedFlow(flowFile)) {
        skippedFlows.push(flowFile);
      }
      else {
        flowFiles.push(flowFile)
      }
    }
  }
  if (skippedFlows.length > 0) {
    uxLog(this, c.yellow(`Skipped ${skippedFlows.length} managed flows:`));
    for (const skippedFlow of skippedFlows.sort()) {
      uxLog(this, c.yellow(`  ${skippedFlow}`));
    }
  }
  return flowFiles.sort();
}

export async function isManagedFlow(flowFile: string) {
  const flowXml = await parseXmlFile(flowFile);
  for (const flowNodeType of [
    'start',
    'actionCalls',
    'assignments',
    'customErrors',
    'collectionProcessors',
    'decisions',
    'loops',
    'recordCreates',
    'recordDeletes',
    'recordLookups',
    'recordUpdates',
    'screens',
    'subflows',
    'variables',
    'constants',
    'formulas']) {
    if (flowXml?.Flow?.[flowNodeType] && flowXml?.Flow?.[flowNodeType]?.length > 0) {
      return false;
    }
  }
  return true;
}

export async function listApexFiles(packageDirs) {
  const apexFiles: any[] = [];
  const skippedApex: string[] = [];
  for (const packageDir of packageDirs || []) {
    const apexMetadatas = await glob("**/*.{cls,trigger}", { cwd: packageDir.path, ignore: GLOB_IGNORE_PATTERNS });
    for (const apexMetadata of apexMetadatas) {
      const apexFile = path.join(packageDir.path, apexMetadata).replace(/\\/g, '/');
      if (apexFile.includes('__')) {
        skippedApex.push(apexFile);
      }
      else {
        apexFiles.push(apexFile)
      }
    }
  }
  if (skippedApex.length > 0) {
    uxLog(this, c.yellow(`Skipped ${skippedApex.length} managed Apex:`));
    for (const skippedFlow of skippedApex.sort()) {
      uxLog(this, c.yellow(`  ${skippedFlow}`));
    }
  }
  return apexFiles.sort();
}

export async function listPageFiles(packageDirs) {
  const pageFiles: any[] = [];
  const skippedPages: string[] = [];
  for (const packageDir of packageDirs || []) {
    const pageMetadatas = await glob("**/*.flexipage-meta.xml", { cwd: packageDir.path, ignore: GLOB_IGNORE_PATTERNS });
    for (const pageMetadata of pageMetadatas) {
      const pageFile = path.join(packageDir.path, pageMetadata).replace(/\\/g, '/');
      if (pageFile.includes('__')) {
        skippedPages.push(pageFile);
      }
      else {
        pageFiles.push(pageFile)
      }
    }
  }
  if (skippedPages.length > 0) {
    uxLog(this, c.yellow(`Skipped ${skippedPages.length} managed Lightning Pages:`));
    for (const skippedPage of skippedPages.sort()) {
      uxLog(this, c.yellow(`  ${skippedPage}`));
    }
  }
  return pageFiles.sort();
}

export function returnApexType(apexCode: string) {
  const apexContentlower = apexCode.toLowerCase();
  return apexContentlower.includes("@istest(seealldata=true)") ? "Test (See All Data)" :
    apexContentlower.includes("@istest") ? "Test" :
      apexContentlower.includes("@invocablemethod") ? "Invocable" :
        apexContentlower.includes("@restresource") ? "REST" :
          apexContentlower.includes("implements database.batchable") ? "Batch" :
            apexContentlower.includes("implements batchable") ? "Batch" :
              apexContentlower.includes("implements database.schedulable") ? "Schedulable" :
                apexContentlower.includes("implements schedulable") ? "Schedulable" :
                  apexContentlower.includes("@auraenabled") ? "Lightning Controller" :
                    apexContentlower.includes("apexpages.standardcontroller") ? "Visualforce Controller" :
                      apexContentlower.includes("pagereference") ? "Visualforce Controller" :
                        apexContentlower.includes("triggerhandler") ? "Trigger Handler" :
                          apexContentlower.includes("new httprequest") ? "Callout" :
                            apexContentlower.includes("jsonparser parser") ? "JSON" :
                              apexContentlower.includes("public class soaprequest") ? "SOAP" :
                                "Class";
}

/**
 * Lists all LWC components in the project
 * @param packageDirs Array of package directories to search in
 * @returns Array of objects with info about each LWC component
 */
export async function listLwcComponents(packageDirs) {
  const lwcComponents: any[] = [];
  const skippedComponents: string[] = [];
  
  for (const packageDir of packageDirs || []) {
    // First find all LWC component directories
    const lwcFolders = await glob("**/lwc/*", { cwd: packageDir.path, ignore: GLOB_IGNORE_PATTERNS });
    
    for (const lwcFolder of lwcFolders) {
      const folderPath = path.join(packageDir.path, lwcFolder).replace(/\\/g, '/');
      
      // Skip if not a directory
      if (!fs.lstatSync(folderPath).isDirectory()) {
        continue;
      }
      
      // Find the main JS file - this would be the one with the same name as the folder
      const componentName = path.basename(folderPath);
      const jsFilePath = path.join(folderPath, `${componentName}.js`);
      
      if (fs.existsSync(jsFilePath)) {
        // Check if it's not a managed component (has namespace prefix)
        if (componentName.includes('__')) {
          skippedComponents.push(jsFilePath);
        } else {
          // Find additional files like the HTML template and metadata
          const htmlFilePath = path.join(folderPath, `${componentName}.html`);
          const metaFilePath = path.join(folderPath, `${componentName}.js-meta.xml`);
          
          lwcComponents.push({
            name: componentName,
            jsFile: jsFilePath,
            htmlFile: fs.existsSync(htmlFilePath) ? htmlFilePath : null,
            metaFile: fs.existsSync(metaFilePath) ? metaFilePath : null,
            folder: folderPath
          });
        }
      }
    }
  }
  
  if (skippedComponents.length > 0) {
    uxLog(this, c.yellow(`Skipped ${skippedComponents.length} managed LWC components:`));
    for (const skippedComponent of skippedComponents.sort()) {
      uxLog(this, c.yellow(`  ${skippedComponent}`));
    }
  }
  
  return lwcComponents.sort((a, b) => a.name.localeCompare(b.name));
}