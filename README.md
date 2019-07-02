# Symfony Helper

A VSCode extension (and language server) for Symfony projects (starting with version 4.0 of Symfony)

[![Linux Build Status](https://travis-ci.org/tmrdh/symfony-helper.svg?branch=master)](https://travis-ci.org/tmrdh/symfony-helper)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/06dgvoqb55ieb8p9?svg=true)](https://ci.appveyor.com/project/tmrdh/symfony-helper)
[![Coverage Status](https://coveralls.io/repos/github/tmrdh/symfony-helper/badge.svg?branch=master)](https://coveralls.io/github/tmrdh/symfony-helper?branch=master)

New in version 1.0.4<br>
<span style="color: red">⭐⭐⭐</span> basic support of Symfony 3.4 <span style="color: red">⭐⭐⭐</span>

## Some previews

Search for references to entity field in dql and twig.

![references](assets/show-references.gif)

Completion in dql

![dql-completion](assets/show-dql-completion.gif)

Completion of route in `href`.

![route-completion](assets/show-route-completion.gif)

Completion of autowired typehints (start typing with '.')

![typehint-completion](assets/show-typehint-completion.gif)


## Features

`Support` means some combination of completion, definition, hover, reference search and signature help.

### Twig

* Support of user-defined and vendor-defined functions, filters, tests and globals
* Support of variables defined in `AbstractController#render()`, `{%set%}` and `twig.yaml`
* Support of macros
* Support of properties and methods of objects
* Support of first argument of functions `path()`, `url()`, `constant()`
* Support of template names in `extends` and `include` tags
* Support of block names
* Special completion of route name in `href`
* Smarter snippets for tags
    * only shown outside of `{%%}`, `{{}}` and `{##}`
    * autoindent for `{%end*%}` and `{%else*%}` after completion
* Folding
* `Extend Template` command<br>
  Position and layout of used blocks are stored in `.symfony-helper.json` file and can be configured by hand.
* `Toggle Twig Comment` command<br>
  It uncomments comment when cursor is inside of the comment.<br>
  It comments selected block of text when that block is not inside comment.
* `Open Compiled Template` command<br>
  It opens compiled form of template from `var/cache/dev/twig/`

### Doctrine and DQL

* Support of entities and entity fields in dql string literals
* Definition and hover for `repositoryClass` and `targetEntity` in annotations of entity classes

### PHP
* Completion of autowired typehints (start typing with '.' because I don't want intersection with php intellisense)
* Support of first argument of methods `generateUrl()`, `render()`, `get()`, `getParameter()` of `AbstractController`
* Support of first argument of `UrlGeneratorInterface#generate()`


### YAML

* Definition and hover for `controller` field in routing files

### XML

In service definition files

* Definition and hover for `class` and `alias` attributes of `<service>`
* Definition and hover for `id` attribute of `<argument type="service">` in service definitions

### Containers and virtual machines (docker, vagrant, ...)

1) Install `vscode-symfony-helper.php` into the `public/` or `web/` folder of your project with `Install Http Helper` command.
2) Configure web server of container to access installed file with browser.
3) Properly set `symfonyHelper.consoleHelper.*` settings.

## Configuring

1. Extension needs a globally installed php interpreter (see `symfonyHelper.phpParser.phpPath` setting)
2. For best speed, set `symfonyHelper.phpParser.phpPath` to php without `xdebug`

## Hints

* If type of a variable aren't recognized in twig, try `@var` annotation.
* Add `php` to `emmet.excludeLanguages`, because emmet gives useless suggestions in dql queries.
* This extension doesn't really make sense without a vscode extension for php. The best one is probably [PHP Intelephense](https://marketplace.visualstudio.com/items?itemName=bmewburn.vscode-intelephense-client).

## Roadmap

* Support twig and dql in arbitrary php projects (it also means `older versions of symfony`)
* Support dql query builder (and also refactoring to dql and from dql)
* Make sure that language server is really reusable
* Rewrite php parser (in typescript or rust) and use it as javascript/wasm module. External parser process annoys me.

## Real State of the Project

Many features are unfinished and inconsistent.

Source code needs serious refactoring.

Extension was properly tested only on one Symfony 4.2 project on my linux machine.
