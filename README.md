# Symfony Helper

A VSCode extension for Twig and DQL in any PHP project. Special support for Symfony projects.

[![Linux Build Status](https://travis-ci.org/tmrdh/symfony-helper.svg?branch=master)](https://travis-ci.org/tmrdh/symfony-helper)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/06dgvoqb55ieb8p9?svg=true)](https://ci.appveyor.com/project/tmrdh/symfony-helper)
[![Coverage Status](https://coveralls.io/repos/github/tmrdh/symfony-helper/badge.svg?branch=master)](https://coveralls.io/github/tmrdh/symfony-helper?branch=master)

New in version 1.0.7

* basic support for entities defined in xml files (only in Symfony projects; only definition, hover and completion in DQL literals)

New in version 1.0.6

* support for Symfony projects starting from version 2.8 of Symfony
* basic support for arbitrary PHP projects (see [here](https://github.com/tmrdh/symfony-helper/wiki/Arbitrary-PHP-Projects))

## Some previews

Search for references to entity field in dql and twig.

![references](assets/show-references.gif)

<br>
Completion in dql

![dql-completion](assets/show-dql-completion.gif)

<br>
Completion for route in `href`.

![route-completion](assets/show-route-completion.gif)

<br>
Completion for autowired typehints (start typing with '.')

![typehint-completion](assets/show-typehint-completion.gif)


## Features

`Support` means some combination of completion, definition, hover, reference search and signature help.

### Twig

* Support for user-defined and vendor-defined functions, filters, tests and globals
* Support for variables defined in `AbstractController#render()`, `{%set%}` and `twig.yaml`
* Support for macros
* Support for properties and methods of objects
* Support for first argument of functions `path()`, `url()`, `constant()`
* Support for template names in `extends` and `include` tags
* Support for block names
* Special completion of route name in `href`
* Snippets for tags
    * They are active only outside of `{%%}`, `{{}}` and `{##}`
    * `{%end*%}` and `{%else*%}` are autoindented after completion
* Folding
* `Extend Template` command<br>
  Position and layout of used blocks are stored in `.symfony-helper.json` file and can be configured by hand.
* `Toggle Twig Comment` command<br>
  It uncomments comment when cursor is inside of the comment.<br>
  It comments selected block of text when that block is not inside comment.
* `Open Compiled Template` command<br>
  It opens compiled form of template from `var/cache/dev/twig/`

### Doctrine and DQL

* Support for entities and entity fields in dql string literals
* Definition and hover for `repositoryClass` and `targetEntity` in annotations of entity classes

### PHP
* Completion for autowired typehints (start typing with '.' because I don't want intersection with php intellisense)
* Support for first argument of methods `generateUrl()`, `render()`, `get()`, `getParameter()` of `AbstractController`
* Support for first argument of `UrlGeneratorInterface#generate()`


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

* Finish support for twig and dql in arbitrary php projects
* Add support for dql query builder (definition and completion for entity fields, refactoring to dql and from dql)
* Make sure that language server is really reusable
