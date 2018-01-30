
###  开发者指南

``minio-go``欢迎你的贡献。为了让大家配合更加默契，我们做出如下约定：

* fork项目并修改，我们鼓励大家使用pull requests进行代码相关的讨论。
    - Fork项目
    - 创建你的特性分支 (git checkout -b my-new-feature)
    - Commit你的修改(git commit -am 'Add some feature')
    - Push到远程分支(git push origin my-new-feature)
    - 创建一个Pull Request

* 当你准备创建pull request时，请确保：
    - 写单元测试，如果你有什么疑问，请在pull request中提出来。
    - 运行`go fmt`
    - 将你的多个提交合并成一个提交： `git rebase -i`。你可以强制update你的pull request。
    - 确保`go test -race ./...`和`go build`完成。
      注意：go test会进行功能测试，这需要你有一个AWS S3账号。将账户信息设为``ACCESS_KEY``和``SECRET_KEY``环境变量。如果想运行简版测试，请使用``go test -short -race ./...``。

* 请阅读 [Effective Go](https://github.com/golang/go/wiki/CodeReviewComments) 
    - `minio-go`项目严格符合Golang风格
    - 如果您看到代码有问题，请随时发一个pull request
