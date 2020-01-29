/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */

export abstract class Type {
    private _topClass = 'Type'; // could not get errors without it. use something else instead of classes?

    public abstract equals(type: Type): boolean;
}

export class AnyType extends Type {
    public equals(type: Type): boolean {
        return type instanceof AnyType;
    }
}

export class ObjectType extends Type {
    private className: string;

    public constructor(className: string) {
        super();
        this.className = className;
    }

    public getClassName() {
        return this.className;
    }

    public equals(type: Type): boolean {
        return (type instanceof ObjectType) && (type.getClassName() === this.className);
    }
}

export class ArrayType extends Type {
    private valueType: Type;

    private knownValues?: { [key: string]: Type };

    public constructor(valueType: Type, knownValues?: { [key: string]: Type }) {
        super();
        this.valueType = valueType;
        this.knownValues = knownValues;
    }

    public getValueType() {
        return this.valueType;
    }

    public getKnownValues() {
        return (this.knownValues === undefined) ? {} : this.knownValues;
    }

    public equals(type: Type): boolean {
        if (!(type instanceof ArrayType)) {
            return false;
        }

        let values1 = (this.knownValues === undefined) ? {} : this.knownValues;
        let keys1 = Object.keys(values1);
        let values2 = type.getKnownValues();
        let keys2 = Object.keys(values2);

        keys1.push(...keys2);

        let keys = keys1; // too lazy to deduplicate
        for (let k of keys) {
            if (values1[k] === undefined || values2[k] === undefined) {
                return false;
            }

            if (!values1[k].equals(values2[k])) {
                return false;
            }
        }

        return true;
    }
}

// this should be subclass of ObjectType
export class EntityRepositoryType extends Type {
    private entityClassName: string;

    public constructor(entityClassName: string) {
        super();
        this.entityClassName = entityClassName;
    }

    public getEntityClassName() {
        return this.entityClassName;
    }

    public equals(type: Type): boolean {
        return (type instanceof EntityRepositoryType) && (this.entityClassName === type.getEntityClassName());
    }
}

// this should be subclass of ObjectType
export class DoctrineQueryType extends Type {
    private entityClassName: string;

    public constructor(entityClassName: string) {
        super();
        this.entityClassName = entityClassName;
    }

    public getEntityClassName() {
        return this.entityClassName;
    }

    public equals(type: Type): boolean {
        return (type instanceof DoctrineQueryType) && (this.entityClassName === type.getEntityClassName());
    }
}

/**
 * Hacky (and kinda wrong) union of types
 */
export function combineTypes(types: Type[]): Type {
    if (types.length === 0) {
        return new AnyType();
    }

    if (types.length === 1) {
        return types[0];
    }

    let firstArrayType = types.find(row => row instanceof ArrayType);
    if (firstArrayType !== undefined) {
        let noOtherTypes = true;
        for (let t of types) {
            if (!(t instanceof AnyType)) {
                if (!t.equals(firstArrayType)) {
                    noOtherTypes = false;
                    break;
                }
            }
        }
        if (noOtherTypes) {
            return firstArrayType;
        }
    }

    let firstObjectType = types.find(row => row instanceof ObjectType);
    if (firstObjectType !== undefined) {
        let noOtherTypes = true;
        for (let t of types) {
            if (!(t instanceof AnyType)) {
                if (!t.equals(firstObjectType)) {
                    noOtherTypes = false;
                    break;
                }
            }
        }
        if (noOtherTypes) {
            return firstObjectType;
        }
    }

    return new AnyType();
}

export interface PhpClassConstant {
    name: string;
    offset: number;
    shortHelp?: string; // first paragraph of doc-comment if found
    valueText?: string; // literally copied symbols of value if it's not too long and has no '\n'
    isPublic: boolean;
}

export interface PhpClassMethod {
    name: string;
    offset: number;
    isPublic: boolean;
    isStatic: boolean;
    params: { name: string }[];
    shortHelp?: string; // first paragraph of doc-comment if found
    returnType: Type;
}

export interface PhpClassProperty {
    name: string;
    offset: number;
    shortHelp?: string;  // first paragraph of doc-comment if found
    isPublic: boolean;
    type: Type;
}

export interface PhpClassSomeInfo {
    shortHelp?: string;
    constants: PhpClassConstant[];
    properties: PhpClassProperty[];
    methods: PhpClassMethod[];
}

export type PhpClassSomeInfoResolver = (className: string) => Promise<PhpClassSomeInfo|null>;
