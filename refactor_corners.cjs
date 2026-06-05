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
            if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
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

    // Replace medium rounded corners to enforce strict sharp civic edges
    content = content.replace(/\brounded-md\b/g, 'rounded-sm');
    content = content.replace(/\bshadow-md\b/g, 'shadow-sm');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated content in ${file}`);
    }
});
