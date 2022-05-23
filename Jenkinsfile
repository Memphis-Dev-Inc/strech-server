def imageName = "memphis-control-plane-staging"
def containerName = "memphis-control-plane"
def gitURL = "git@github.com:Memphis-OS/memphis-control-plane.git"
def gitBranch = "staging"
def repoUrlPrefix = "memphisos"
unique_Id = UUID.randomUUID().toString()
def DOCKER_HUB_CREDS = credentials('docker-hub')

node {
  try{
    stage('SCM checkout') {
        git credentialsId: 'main-github', url: gitURL, branch: gitBranch
    }
	  
    stage('Login to Docker Hub') {
	    withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_HUB_CREDS_USR', passwordVariable: 'DOCKER_HUB_CREDS_PSW')]) {
		  sh "docker login -u $DOCKER_HUB_CREDS_USR -p $DOCKER_HUB_CREDS_PSW"
	    }
    }
	  
    stage('Create memphis namespace in Kubernetes'){
      sh "kubectl create ns memphis"
    }

    stage('Build and push docker image to Docker Hub') {
      sh "docker buildx build --push -t ${repoUrlPrefix}/${imageName}-${test_suffix} --platform linux/amd64,linux/arm64 ."
    }

    stage('Tests - Install/upgrade Memphis cli') {
      sh "sudo npm uninstall memphis-dev-cli"
      sh "sudo npm i memphis-dev-cli -g"
    }

    stage('Tests - Docker compose install') {
      sh "docker-compose -f /var/lib/jenkins/tests/docker-compose-files/docker-compose-dev-memphis-control-plane.yml -p memphis up -d"
    }

    stage('Tests - Run e2e tests over Docker') {
      sh "rm -rf memphis-e2e-tests"
      sh "git clone git@github.com:Memphis-OS/memphis-e2e-tests.git"
      sh "npm install --prefix ./memphis-e2e-tests"
      sh "node ./memphis-e2e-tests/index.js docker"
    }

    stage('Tests - Remove Docker compose') {
      sh "docker-compose -f /var/lib/jenkins/tests/docker-compose-files/docker-compose-dev-memphis-control-plane.yml -p memphis down"
    }

    stage('Tests - Install memphis with helm') {
      sh "rm -rf memphis-k8s"
      sh "git clone --branch tests git@github.com:Memphis-OS/memphis-k8s.git"
      sh 'helm install memphis-tests memphis-k8s/helm/memphis --set analytics="false",teston="cp" --create-namespace --namespace memphis'
      sh 'sleep 30'
    }

    stage('Tests - Run e2e tests over kubernetes') {
      sh "npm install --prefix ./memphis-e2e-tests"
      sh "node ./memphis-e2e-tests/index.js kubernetes"
    }

    stage('Tests - Uninstall helm') {
      sh "helm uninstall memphis -n memphis"
      sh "kubectl delete ns memphis"
    }

    stage('Tests - Remove e2e-tests') {
      sh "rm -rf memphis-e2e-tests"
    }

    stage('Create Staging ECR Repo') {
      sh "aws ecr describe-repositories --repository-names ${imageName} --region eu-central-1 || aws ecr create-repository --repository-name ${imageName} --region eu-central-1 && aws ecr put-lifecycle-policy --repository-name ${imageName} --region eu-central-1 --lifecycle-policy-text 'file:///var/lib/jenkins/utils/ecr-lifecycle-policy.json'"
    }
	  
    stage('Build and push docker image to ECR') {
      sh "docker buildx build --push -t ${repoUrlPrefix}/${imageName} --platform linux/amd64,linux/arm64 ."
    }
    
    stage('Push docker image') {
	withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_HUB_CREDS_USR', passwordVariable: 'DOCKER_HUB_CREDS_PSW')]) {
		sh "docker login -u $DOCKER_HUB_CREDS_USR -p $DOCKER_HUB_CREDS_PSW"
	}
    }

    stage('Build docker image') {
	sh "docker buildx build --push -t ${dockerImagesRepo}/${imageName}:latest --platform linux/amd64,linux/arm/v7,linux/arm64 ."
    }
    
    notifySuccessful()

  } catch (e) {
      currentBuild.result = "FAILED"
      notifyFailed()
      throw e
  }
}

def notifySuccessful() {
  emailext (
      subject: "SUCCESSFUL: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
      body: """<p>SUCCESSFUL: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':</p>
        <p>Check console output at &QUOT;<a href='${env.BUILD_URL}'>${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>&QUOT;</p>""",
      recipientProviders: [[$class: 'DevelopersRecipientProvider']]
    )
}

def notifyFailed() {
  emailext (
      subject: "FAILED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
      body: """<p>FAILED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':</p>
        <p>Check console output at &QUOT;<a href='${env.BUILD_URL}'>${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>&QUOT;</p>""",
      recipientProviders: [[$class: 'DevelopersRecipientProvider']]
    )
}
