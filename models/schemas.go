// Credit for The NATS.IO Authors
// Copyright 2021-2022 The Memphis Authors
// Licensed under the MIT License (the "License");
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// This license limiting reselling the software itself "AS IS".

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Schema struct {
	ID   primitive.ObjectID `json:"id" bson:"_id"`
	Name string             `json:"name" bson:"name"`
	Type string             `json:"type" bson:"type"`
}

type SchemaVersion struct {
	ID                primitive.ObjectID `json:"id" bson:"_id"`
	VersionNumber     int                `json:"version_number" bson:"version_number"`
	Active            bool               `json:"active" bson:"active"`
	CreatedByUser     string             `json:"created_by_user" bson:"created_by_user"`
	CreationDate      time.Time          `json:"creation_date" bson:"creation_date"`
	SchemaContent     string             `json:"schema_content" bson:"schema_content"`
	SchemaId          primitive.ObjectID `json:"schema_id" bson:"schema_id"`
	MessageStructName string             `json:"message_struct_name" bson:"message_struct_name"`
	Descriptor        string             `json:"-" bson:"descriptor"`
}

type CreateNewSchema struct {
	Name              string      `json:"name" binding:"required,min=1,max=32"`
	Type              string      `json:"type"`
	SchemaContent     string      `json:"schema_content"`
	Tags              []CreateTag `json:"tags"`
	MessageStructName string      `json:"message_struct_name"`
}

type ExtendedSchema struct {
	ID                  primitive.ObjectID `json:"id" bson:"_id"`
	Name                string             `json:"name" bson:"name"`
	Type                string             `json:"type" bson:"type"`
	CreatedByUser       string             `json:"created_by_user" bson:"created_by_user"`
	CreationDate        time.Time          `json:"creation_date" bson:"creation_date"`
	ActiveVersionNumber int                `json:"active_version_number" bson:"version_number"`
	Used                bool               `json:"used"`
	Tags                []Tag              `json:"tags"`
}

type ExtendedSchemaDetails struct {
	ID           primitive.ObjectID `json:"id"`
	SchemaName   string             `json:"schema_name"`
	Type         string             `json:"type"`
	Versions     []SchemaVersion    `json:"versions"`
	UsedStations []string           `json:"used_stations"`
	Tags         []Tag              `json:"tags"`
}

type GetSchemaDetails struct {
	SchemaName string `form:"schema_name" json:"schema_name"`
}

type RemoveSchema struct {
	SchemaNames []string `json:"schema_names" binding:"required"`
}

type CreateNewVersion struct {
	SchemaName        string `json:"schema_name"`
	SchemaContent     string `json:"schema_content"`
	MessageStructName string `json:"message_struct_name"`
}

type RollBackVersion struct {
	SchemaName    string `json:"schema_name"`
	VersionNumber int    `json:"version_number"`
}

type ValidateSchema struct {
	SchemaType    string `json:"schema_type"`
	SchemaContent string `json:"schema_content"`
}
