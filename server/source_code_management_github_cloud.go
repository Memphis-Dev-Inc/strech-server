package server

import (
	"context"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"

	"github.com/memphisdev/memphis/models"
	"gopkg.in/yaml.v2"

	"github.com/google/go-github/github"
)

const (
	memphisDevFunctionsRepoName   = "memphis-dev-functions"
	memphisDevFunctionsOwnerName  = "memphisdev"
	memphisDevFunctionsBranchName = "master"
)

var memphisFunctions = map[string]interface{}{
	"repo_name":  memphisDevFunctionsRepoName,
	"branch":     "master",
	"type":       "functions",
	"repo_owner": memphisDevFunctionsOwnerName,
}

func (it IntegrationsHandler) handleCreateGithubIntegration(tenantName string, keys map[string]interface{}) (models.Integration, int, error) {
	return models.Integration{}, 0, nil
}

func (it IntegrationsHandler) handleUpdateGithubIntegration(user models.User, body models.CreateIntegrationSchema) (models.Integration, int, error) {
	return models.Integration{}, 0, nil
}

func cacheDetailsGithub(keys map[string]interface{}, properties map[string]bool, tenantName string) {
}

func getGithubClientWithoutAccessToken() *github.Client {
	client := github.NewClient(nil)
	return client
}

func testGithubIntegration(installationId string) error {
	return nil
}

func (s *Server) getGithubRepositories(integration models.Integration, body interface{}) (models.Integration, interface{}, error) {
	return models.Integration{}, nil, nil
}

func (s *Server) getGithubBranches(integration models.Integration, body interface{}) (models.Integration, interface{}, error) {
	return models.Integration{}, nil, nil
}

func GetGithubContentFromConnectedRepo(connectedRepo map[string]interface{}, functionsDetails map[string][]functionDetails, tenantName string) (map[string][]functionDetails, error) {
	branch := connectedRepo["branch"].(string)
	repo := connectedRepo["repo_name"].(string)
	owner := connectedRepo["repo_owner"].(string)

	var client *github.Client
	var err error
	client = getGithubClientWithoutAccessToken()
	_, repoContent, _, err := client.Repositories.GetContents(context.Background(), owner, repo, "", &github.RepositoryContentGetOptions{
		Ref: branch})
	if err != nil {
		return functionsDetails, err
	}

	countFunctions := 0
	for _, directoryContent := range repoContent {
		// In order to restrict the api calls per repo
		if countFunctions == 10 {
			break
		}
		if directoryContent.GetType() == "dir" {
			_, filesContent, _, err := client.Repositories.GetContents(context.Background(), owner, repo, *directoryContent.Path, &github.RepositoryContentGetOptions{
				Ref: branch})
			if err != nil {
				continue
			}

			isValidFileYaml := false
			for _, fileContent := range filesContent {
				var content *github.RepositoryContent
				var commit *github.RepositoryCommit
				var contentMap map[string]interface{}
				if *fileContent.Type == "file" && *fileContent.Name == "memphis.yaml" {
					content, _, _, err = client.Repositories.GetContents(context.Background(), owner, repo, *fileContent.Path, &github.RepositoryContentGetOptions{
						Ref: branch})
					if err != nil {
						continue
					}

					decodedContent, err := base64.StdEncoding.DecodeString(*content.Content)
					if err != nil {
						continue
					}

					err = yaml.Unmarshal(decodedContent, &contentMap)
					if err != nil {
						continue
					}

					if _, ok := contentMap["memory"]; !ok || contentMap["memory"] == "" {
						contentMap["memory"] = 128 * 1024 * 1024
					}

					if _, ok := contentMap["storage"]; !ok || contentMap["storage"] == "" {
						contentMap["storage"] = 512 * 1024 * 1024
					}

					dependenciesMissing := false
					if dependencies, ok := contentMap["dependencies"]; !ok || dependencies == nil || dependencies.(string) == "" {
						dependenciesMissing = true
					}
					runtime := ""
					if runtimeInterface, ok := contentMap["runtime"]; !ok || runtimeInterface == nil || runtimeInterface.(string) == "" {
						continue
					} else {
						runtime = runtimeInterface.(string)
					}
					re := regexp.MustCompile("^[^0-9.]+")
					lang := re.FindString(runtime)
					if lang != "go" && lang != "python" && lang != "nodejs" {
						continue
					}
					if dependenciesMissing {
						switch lang {
						case "go":
							contentMap["dependencies"] = "go.mod"
						case "nodejs":
							contentMap["dependencies"] = "package.json"
						case "python":
							contentMap["dependencies"] = "requirements.txt"
						}
					}

					splitPath := strings.Split(*fileContent.Path, "/")
					path := strings.TrimSpace(splitPath[0])

					err = validateYamlContent(contentMap)
					if err != nil {
						isValidFileYaml = false
						fileDetails := functionDetails{
							ContentMap:   contentMap,
							RepoName:     repo,
							Branch:       branch,
							Owner:        owner,
							DirectoryUrl: directoryContent.HTMLURL,
							TenantName:   tenantName,
						}
						message := fmt.Sprintf("In the repository %s, the yaml file %s is invalid: %s", repo, splitPath[0], err.Error())
						serv.Warnf("[tenant: %s]GetGithubContentFromConnectedRepo: %s", tenantName, message)
						fileDetails.IsValid = false
						fileDetails.InvalidReason = message
						functionsDetails["other"] = append(functionsDetails["other"], fileDetails)
						continue
					}
					isValidFileYaml = true
					commit, _, err = client.Repositories.GetCommit(context.Background(), owner, repo, branch)
					if err != nil {
						continue
					}

					fileDetails := functionDetails{
						Commit:       commit,
						ContentMap:   contentMap,
						RepoName:     repo,
						Branch:       branch,
						Owner:        owner,
						DirectoryUrl: directoryContent.HTMLURL,
						TenantName:   tenantName,
					}

					functionName := ""
					if functionNameInterface, ok := contentMap["function_name"]; !ok || functionNameInterface == nil || functionNameInterface.(string) == "" {
						continue
					} else {
						functionName = functionNameInterface.(string)
					}

					if path != functionName {
						message := fmt.Sprintf("In the repository %s, function name %s in git doesn't match the function_name field %s in YAML file.", repo, splitPath[0], functionName)
						serv.Warnf("[tenant: %s]GetGithubContentFromConnectedRepo: %s", tenantName, message)
						fileDetails.IsValid = false
						fileDetails.InvalidReason = message
						functionsDetails["other"] = append(functionsDetails["other"], fileDetails)
						continue
					}
					if strings.Contains(path, " ") {
						message := fmt.Sprintf("In the repository %s, the function name %s in the YAML file cannot contain spaces", repo, functionName)
						serv.Warnf("[tenant: %s]GetGithubContentFromConnectedRepo: %s", tenantName, message)
						fileDetails.IsValid = false
						fileDetails.InvalidReason = message
						functionsDetails["other"] = append(functionsDetails["other"], fileDetails)
						continue
					}

					if isValidFileYaml {
						countFunctions++
						fileDetails.IsValid = true
						functionsDetails["other"] = append(functionsDetails["other"], fileDetails)
						break
					}
				}
			}
			if !isValidFileYaml {
				continue
			}
		}
	}

	return functionsDetails, nil
}

func deleteInstallationForAuthenticatedGithubApp(tenantName string) error {
	return nil
}

func getGithubKeys(githubIntegrationDetails map[string]interface{}, repoOwner, repo, branch, repoType string) map[string]interface{} {
	return map[string]interface{}{}
}

func retrieveGithubAppName() string {
	return ""
}
