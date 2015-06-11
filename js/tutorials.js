$(function() {
    var queryParse = function(queryStr) {
      var query = {}
        , queries, q
        ;

      queryStr = queryStr || '';
      queries = queryStr.split("&");

      for(var i = 0; i < queries.length; i++){
        q = queries[i].split("=");
        query[q[0]] = q[1];
      }
      return query;
    };

    var htmlCm, jsCm
      , router = new Router()
      , tutor
      ;

    var TuTor = Bee.extend({
      //运行示例代码
      run: function() {
        var output = frames.output.document;
        var html = htmlCm.getValue();
        output.open();
        output.write(html)
        output.write('<script> Bee = top.Bee </script>')
        output.write('<script>' + jsCm.getValue() + '</script>');
        output.close()
      }
    , marked: function(note) {
        return marked(note);
      }
    , events: {
        'click #prev-step:not(.disabled)': function() {
          if(this.stepIndex > 1){
            //this.setStep(this.stepIndex - 2);
            this.navigate(this.chapterIndex + '/' + (this.stepIndex - 1))
          }
        }
      , 'click .next-step:not(.disabled)': function() {
          if(this.stepIndex < this.$get('chapter.steps').length || this.writeMode){
            //this.setStep(this.stepIndex);
            this.navigate(this.chapterIndex + '/' + (this.stepIndex + 1));
          }else{
            this.navigate(this.chapterIndex + 1);
          }
        }
      , 'click #prev-chapter:not(.disabled)': function() {
          if(this.chapterIndex > 1){
            this.navigate(this.chapterIndex - 1);
          }
        }
      , 'click #next-chapter:not(.disabled)': function() {
          if(this.chapterIndex < this.$get('tutorial.list').length || this.writeMode){
            //this.setChapter(this.chapterIndex);
            this.navigate(this.chapterIndex + 1);
          }
        }
      , 'click .fixcode': function(e){
          if(!$(e.target).hasClass('disabled') && this.step.fixCode){
             this.step.fixCode.html && htmlCm.setValue(this.step.fixCode.html);
             this.step.fixCode.javascript && jsCm.setValue(this.step.fixCode.javascript);
          }
        }
      , 'click #reset': function(e){
          this.setStep(this.stepIndex - 1);
        }

        //编辑模式 only
      , 'click #save': function(e) {
          this.save();
        }
      , 'click #download': function(e) {
          e.currentTarget.href = 'data:text/json,' + encodeURIComponent(this.save());
        }
      , 'click .write-pad .nav-tabs li:not(.active)': function(e) {
          var $li = $(e.currentTarget)
            , index = $li.index()
            ;

          $li.siblings('.active').removeClass('active');
          $li.addClass('active');

          $('.write-pad .tab-content .tab-pane').removeClass('active').eq(index).addClass('active');
        }
      , 'click #rm_cur_chapter': function() {
          if(confirm('确认删除本章?')) {
            this.tutorial.list.splice(this.chapterIndex - 1, 1);
            this.chapterIndex > 1 ? this.navigate(this.chapterIndex - 1, 1) : this.setChapter(0);
          }
        }

      , 'click #rm_cur_step': function() {
          if(confirm('确认删除本小节?')) {
            this.tutorial.list[this.chapterIndex - 1].steps.splice(this.stepIndex - 1, 1);
            this.stepIndex > 1 ? this.navigate(this.chapterIndex + '/' + (this.stepIndex - 1), 1) : this.setChapter(this.chapterIndex - 1, 0);
          }
        }
      }
    , $watchers : {
        '(chapter.title || "") + " - " + tutorial.title': function(val) {
          document.title = val;
        }
      }
    , $afterInit: function() {
        var that = this;
        $('#loading').fadeOut();
        $(this.$el).fadeIn();
        htmlCm = CodeMirror.fromTextArea(document.getElementById('template'), {
          lineNumbers: true
        , lineWrapping: true
        , mode: 'text/html'
        , theme: "base16-dark"
        , profile: 'xhtml'
        });

        jsCm = CodeMirror.fromTextArea(document.getElementById('javascript'), {
          lineNumbers: true
        , lineWrapping: true
        , mode: 'javascript'
        , theme: "base16-dark"
        });

        htmlCm.on('change', function() {
          that.run()
        })

        jsCm.on('change', function() {
          that.run()
        })

        //this.setChapter(0);
      }
    , setStep: function(index) {
        var steps = this.$get('chapter').steps;
        var step = steps[index];
        index = index * 1;
        if((!step) && this.writeMode){
          step = {};
          steps.push(step);
        }
        this.$replace('step', step);
        this.$set({
          stepIndex: index + 1
        , hasNextStep: index < this.chapter.steps.length - 1 || this.hasNextChapter || this.writeMode
        });
        htmlCm.setValue($('#template').val());
        jsCm.setValue($('#javascript').val())
        //this.run();
        setTimeout(function(){
          if(step.init){
            var fn = new Function(step.init)
            fn()
          }
        }, 0);
      }
    , setChapter: function(index, stepIndex) {
        var chapter, tutorials = this.tutorial.list;
        index = index * 1;
        if(isNaN(index)){
          return;
        }
        chapter = tutorials[index];

        if((!chapter) && this.writeMode){
          chapter = {steps: []};
          tutorials.push(chapter);
        }
        this.$replace('chapter', chapter);
        this.$set({
          chapterIndex: index + 1
        , hasNextChapter: index < this.tutorial.list.length - 1 || this.writeMode
        });

        if(stepIndex * 1){
          this.setStep(stepIndex);
        }else{
          this.setStep(0);
        }
      }
    , navigate: function(hash) {
        location.hash = hash + (this.writeMode ? '?write=true' : '');
      }

      //保存数据到 localStorage
    , save: function(){
        var fixCode = this.step.fixCode || {};
        var step = {
              note: this.step.note
            , init: this.step.init
            , html: this.step.html
            , javascript: this.step.javascript
            , fixCode: fixCode
            }
          , html = htmlCm.getValue()
          , js = jsCm.getValue()
          , dataStr
          ;

        (this.isFixHTML ? step.fixCode : step).html = html || undefined;
        (this.isFixJavascript ? step.fixCode : step).javascript = js || undefined;

        // if(!this.isFixHTML && !this.isFixJavascript){
        //   delete step.fixCode;
        // }
        this.tutorial.list[this.chapterIndex - 1].title = this.chapter.title;
        this.tutorial.list[this.chapterIndex - 1].steps.splice(this.stepIndex - 1, 1, step);
        dataStr = JSON.stringify(this.tutorial, null, 2)
        localStorage.setItem('tutorial-' + filePath, dataStr);
        return dataStr;
      }
    });

    TuTor.directive('on', {
      link: function link(vm) {
        this.vm = vm;
      },
      update: function update(events) {
        var selector, eventType;
        for (var name in events) {
          selector = name.split(/\s+/);
          eventType = selector.shift();
          selector = selector.join(' ');
          $(this.el).on(eventType, selector, events[name].bind(this.vm));
        }
      }
    });

    var query = queryParse(location.search.slice(1))
      , filePath = query.data || 'data.json'
      , fileName
      ;

    fileName = filePath.split('/');
    fileName = fileName[fileName.length - 1].replace(/\?.+$/, '');

    if(!window.notSupport){
      var plain = '{"list": [{"steps": []}], "title": "教程示例"}';

      $.ajax(filePath, {dataType: 'json'}).always(function(data, stat) {
        if(stat !== 'success') {
          data = void(0);
        }
        init(JSON.parse(localStorage.getItem('tutorial-' + filePath) || JSON.stringify(data) || plain));
      });
    }

    function init(tutorial){

      window.tutor = tutor = new TuTor($('#container')[0], {
        $data: {
          tutorial:tutorial
        , fileName: fileName
        , canDownload: 'download' in document.createElement('a')
        }
      });


      router.on('*', function(info) {
          info.query = queryParse(info.search.slice(1))
          var write = info.query.write === 'true'
          tutor.$set('writeMode', write);
          //clearInterval(this.autoSaveTimer);

          if(write){
            //定时自动保存
            //this.autoSaveTimer = setInterval(function() { tutor.save() }, 30000);
          }
        });
        router.on('', function() {
          tutor.navigate('1')
        });
        router.on(':chapter/:step?', function(info) {
          var param = info.param
            , chapter = param.chapter - 1
            , step = (param.step ? param.step : 1) - 1
            ;

          tutor.setChapter(chapter, step);
        });

        router.browser(window, {routeType: 1})
    };

    marked.setOptions({
      highlight: function (code, lang) {
        return hljs.highlightAuto(code, lang).value;
      }
    });
});
