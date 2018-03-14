const fs = require('fs');
const javainfo = require('./javainfo.js');
const template = require('./template.js');

var generatePlugin = function (sourceDir, targetDir, sourceVersion) {
    fs.readdirSync(sourceDir).forEach(function (packageDir) {
        var fullPath = [sourceDir, packageDir].join('/');;
        var stats = fs.statSync(fullPath);
        if (!stats.isDirectory()) return;

        var sourceFile = [];
        fs.readdirSync(fullPath).forEach(function (fileName) {
            var regexp = new RegExp('^[A-Z][a-zA-Z0-9_]+\.java');
            if (regexp.exec(fileName)) {
                if (fileName.indexOf("SWIGTYPE") >= 0) return;
                sourceFile.push(fileName);
            }
        });
        if (sourceFile.length == 0) return;

        var javaPackage = new javainfo.JavaPackage(packageDir);
        javaPackage.version = sourceVersion;

        sourceFile.forEach(function (fileName) {
            var fullName = [sourceDir, packageDir, fileName].join('/');;
            var className = fileName.substring(0, fileName.length - 5);
            var javaClass = new javainfo.JavaClass(className);

            fs.readFileSync(fullName).toString().split('\n').forEach(function (line) {
                line = line.trim();
                if (line.indexOf("public ") == 0) {
                    line = line.substring(7);

                    if (line.indexOf("class") == 0 ||
                        line.indexOf("interface") == 0 ||
                        line.indexOf("synchronized") == 0 ||
                        line.indexOf("final") == 0 ||
                        line.indexOf("static") == 0) {
                        return;
                    }

                    if (line.indexOf("{") != line.length - 1 || line.indexOf("(") < 0 || line.indexOf(")") < 0) {
                        throw Error("Unsupported format: " + fullName + " classname: " + className + " javaClass: " + javaClass + " line: " + line);
                    }

                    if (line.indexOf(className) == 0) {
                        var method = new javainfo.JavaMethod(className);
                        method.parseArgs(line.substring(line.indexOf("(") + 1, line.indexOf(")")));
                        javaClass.constructor = method;
                    } else {
                        var methodName = line.substring(line.indexOf(' ') + 1, line.indexOf('('));
                        var method = new javainfo.JavaMethod(methodName);
                        method.returnType = line.substring(0, line.indexOf(' '));
                        method.parseArgs(line.substring(line.indexOf("(") + 1, line.indexOf(")")));
                        javaClass.methods.push(method);
                    }
                }
            });

            javaClass.packageName = javaPackage.name;
            javaPackage.classes.push(javaClass);
        });

        var pluginDir = [targetDir, javaPackage.getPluginName()].join('/');

        fs.mkdirSync(pluginDir);
        fs.mkdirSync([pluginDir, 'src'].join('/'));
        fs.mkdirSync([pluginDir, 'src', 'android'].join('/'));
        fs.mkdirSync([pluginDir, 'types'].join('/'));
        fs.mkdirSync([pluginDir, 'www'].join('/'));

        var pluginXmlFile = [pluginDir, 'plugin.xml'].join('/');
        fs.writeFileSync(pluginXmlFile, template.generatePluginXml(javaPackage));

        var packageJsonFile = [pluginDir, 'package.json'].join('/');
        fs.writeFileSync(packageJsonFile, template.generatePackagejson(javaPackage));

        var gradleFile = [pluginDir, 'src', 'android', 'androidThings.gradle'].join('/');
        fs.writeFileSync(gradleFile, template.generateGradle(javaPackage));

        var interfaceFile = [pluginDir, "types", 'index.d.ts'].join('/');
        fs.writeFileSync(interfaceFile, template.generateInterface(javaPackage));

        javaPackage.classes.forEach(function (javaClass) {
            var pluginJsFile = [pluginDir, "www", javaClass.name + '.js'].join('/');
            fs.writeFileSync(pluginJsFile, template.generatePluginJs(javaClass));

            var pluginJavaFile = [pluginDir, "src", "android", javaClass.name + 'Plugin.java'].join('/');
            fs.writeFileSync(pluginJavaFile, template.generatePluginJava(javaClass));
        });
    });
}

module.exports = {
    generatePlugin
};
