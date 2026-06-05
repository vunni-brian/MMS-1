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

    // Replace large rounded corners with rounded-sm
    content = content.replace(/\brounded-3xl\b/g, 'rounded-sm');
    content = content.replace(/\brounded-2xl\b/g, 'rounded-sm');
    content = content.replace(/\brounded-xl\b/g, 'rounded-sm');
    content = content.replace(/\brounded-lg\b/g, 'rounded-sm');

    // Replace large shadows with shadow-sm
    content = content.replace(/\bshadow-2xl\b/g, 'shadow-sm');
    content = content.replace(/\bshadow-xl\b/g, 'shadow-sm');
    content = content.replace(/\bshadow-lg\b/g, 'shadow-sm');
    
    // Remove glassmorphism
    content = content.replace(/\bbackdrop-blur-\w+\b/g, '');
    
    // Remove gradients
    content = content.replace(/\bbg-gradient-to-\w+\b/g, '');
    content = content.replace(/\bfrom-\w+(-\d+)?(\/\d+)?\b/g, '');
    content = content.replace(/\bto-\w+(-\d+)?(\/\d+)?\b/g, '');
    
    // Clean up multiple spaces that might result from replacing with empty string
    content = content.replace(/  +/g, ' ');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
