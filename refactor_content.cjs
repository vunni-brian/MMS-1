const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // PageHeader and Panel Title Replacements (Strict replacements to avoid breaking code)
    content = content.replace(/title="Billing"/g, 'title="Revenue & Dues"');
    content = content.replace(/eyebrow="Billing and utilities"/g, 'eyebrow="Revenue collection"');
    content = content.replace(/title="Billing Switches"/g, 'title="Revenue Collection Policies"');
    content = content.replace(/title="Utility Charge Register"/g, 'title="Official Dues Register"');
    
    content = content.replace(/title="User Management"/g, 'title="Personnel & Access Control"');
    content = content.replace(/eyebrow="Access administration"/g, 'eyebrow="Personnel administration"');
    
    content = content.replace(/title="Complaints"/g, 'title="Grievances & Appeals"');
    content = content.replace(/eyebrow="Support and resolution"/g, 'eyebrow="Dispute resolution"');
    
    content = content.replace(/title="Stalls"/g, 'title="Allocated Spaces"');
    content = content.replace(/eyebrow="Market inventory"/g, 'eyebrow="Official inventory"');

    // General terminology replacements in text content (not in code logic)
    content = content.replace(/>Billing</g, '>Revenue & Dues<');
    content = content.replace(/>User Management</g, '>Personnel & Access<');
    content = content.replace(/>Complaints</g, '>Grievances & Appeals<');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated content in ${file}`);
    }
});
